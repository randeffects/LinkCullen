/*
 * Copyright 2025 Greg Willis
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { PrismaClient, SharedLink, User, Role, ShareScope } from '@prisma/client';
import { logger } from '@/lib/logger';

const prisma = new PrismaClient();

interface CreateLinkParams {
  fileId: string;
  fileName: string;
  filePath: string;
  sharedWith: string;
  scope: ShareScope;
  expiresAt?: Date;
  ownerId: string;
}

interface UpdateLinkParams {
  sharedWith?: string;
  scope?: ShareScope;
  expiresAt?: Date | null;
}

interface LinkQueryOptions {
  page?: number;
  limit?: number;
  ownerId?: string;
}

/**
 * Service for managing shared links with role-based access control
 */
export class LinkService {
  /**
   * Create a new shared link
   */
  async createLink(params: CreateLinkParams): Promise<SharedLink> {
    try {
      // Generate a unique link URL
      const linkUrl = this.generateLinkUrl(params.fileId);
      
      // Create the link in the database
      const link = await prisma.sharedLink.create({
        data: {
          fileId: params.fileId,
          fileName: params.fileName,
          filePath: params.filePath,
          sharedWith: params.sharedWith,
          scope: params.scope,
          linkUrl,
          expiresAt: params.expiresAt,
          owner: {
            connect: {
              id: params.ownerId
            }
          }
        }
      });
      
      // Log the creation for audit purposes
      await logger.audit('link.create', params.ownerId, {
        linkId: link.id,
        fileName: link.fileName,
        sharedWith: link.sharedWith,
        scope: link.scope
      });
      
      return link;
    } catch (error) {
      logger.error('Failed to create shared link', error as Error, { params });
      throw error;
    }
  }
  
  /**
   * Get a shared link by ID with role-based access control
   */
  async getLinkById(id: string, user: User): Promise<SharedLink | null> {
    try {
      const link = await prisma.sharedLink.findUnique({
        where: { id }
      });
      
      if (!link) {
        return null;
      }
      
      // RBAC: Only allow access if the user is the owner or an admin
      if (user.role !== Role.ADMIN && link.ownerId !== user.id) {
        logger.warn('Unauthorized access attempt to shared link', {
          userId: user.id,
          linkId: id,
          ownerId: link.ownerId
        });
        return null;
      }
      
      return link;
    } catch (error) {
      logger.error('Failed to get shared link', error as Error, { id, userId: user.id });
      throw error;
    }
  }
  
  /**
   * Get all shared links with pagination and role-based access control
   */
  async getLinks(user: User, options: LinkQueryOptions = {}): Promise<{ data: SharedLink[], total: number }> {
    const { page = 1, limit = 10 } = options;
    const skip = (page - 1) * limit;
    
    try {
      // Build the where clause based on user role
      const where = user.role === Role.ADMIN
        ? {} // Admins can see all links
        : { ownerId: user.id }; // Regular users can only see their own links
      
      // Get links with pagination
      const [links, total] = await Promise.all([
        prisma.sharedLink.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' }
        }),
        prisma.sharedLink.count({ where })
      ]);
      
      return { data: links, total };
    } catch (error) {
      logger.error('Failed to get shared links', error as Error, { 
        userId: user.id, 
        role: user.role,
        page,
        limit
      });
      throw error;
    }
  }
  
  /**
   * Update a shared link with role-based access control
   */
  async updateLink(id: string, params: UpdateLinkParams, user: User): Promise<SharedLink | null> {
    try {
      // First check if the link exists and if the user has permission
      const existingLink = await this.getLinkById(id, user);
      
      if (!existingLink) {
        return null;
      }
      
      // Update the link
      const updatedLink = await prisma.sharedLink.update({
        where: { id },
        data: {
          sharedWith: params.sharedWith,
          scope: params.scope,
          expiresAt: params.expiresAt
        }
      });
      
      // Log the update for audit purposes
      await logger.audit('link.update', user.id, {
        linkId: id,
        updates: params
      });
      
      return updatedLink;
    } catch (error) {
      logger.error('Failed to update shared link', error as Error, { id, params, userId: user.id });
      throw error;
    }
  }
  
  /**
   * Delete a shared link with role-based access control
   */
  async deleteLink(id: string, user: User): Promise<boolean> {
    try {
      // First check if the link exists and if the user has permission
      const existingLink = await this.getLinkById(id, user);
      
      if (!existingLink) {
        return false;
      }
      
      // Delete the link
      await prisma.sharedLink.delete({
        where: { id }
      });
      
      // Log the deletion for audit purposes
      await logger.audit('link.delete', user.id, {
        linkId: id,
        fileName: existingLink.fileName
      });
      
      return true;
    } catch (error) {
      logger.error('Failed to delete shared link', error as Error, { id, userId: user.id });
      throw error;
    }
  }
  
  /**
   * Find links that are about to expire for notification purposes
   */
  async findExpiringLinks(daysThreshold: number = 7): Promise<SharedLink[]> {
    try {
      const now = new Date();
      const thresholdDate = new Date();
      thresholdDate.setDate(now.getDate() + daysThreshold);
      
      // Find links that expire within the threshold period
      const expiringLinks = await prisma.sharedLink.findMany({
        where: {
          expiresAt: {
            not: null,
            gt: now,
            lte: thresholdDate
          }
        },
        include: {
          owner: true
        }
      });
      
      return expiringLinks;
    } catch (error) {
      logger.error('Failed to find expiring links', error as Error, { daysThreshold });
      throw error;
    }
  }
  
  /**
   * Generate a unique link URL
   * In a real implementation, this would be more sophisticated
   */
  private generateLinkUrl(fileId: string): string {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://cullenlinks.com';
    const uniqueId = crypto.randomUUID().substring(0, 8);
    return `${baseUrl}/share/${uniqueId}`;
  }
}

// Export a singleton instance
export const linkService = new LinkService();

// Export the class for testing or custom instances
export default LinkService;