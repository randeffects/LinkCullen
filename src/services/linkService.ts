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

import { createHash } from 'crypto';
import crypto from 'crypto';
import { PrismaClient, TrackedLink, User, Role, ShareType, Permission } from '@prisma/client';
import { Policy } from '@prisma/client';
import { logger } from '@/lib/logger';

const prisma = new PrismaClient();

interface CreateLinkParams {
  fileName: string;
  filePath: string;
  shareType: ShareType;
  recipients: {
    recipient: string;
    permission: Permission;
  }[];
  expiresAt?: Date;
  ownerId: string;
}

interface UpdateLinkParams {
  shareType?: ShareType;
  recipients?: {
    recipient: string;
    permission: Permission;
  }[];
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
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient = new PrismaClient()) {
    this.prisma = prisma;
  }

  private _calculateSHA256(filePath: string): string {
    return createHash('sha256').update(filePath).digest('hex');
  }
  /**
   * Create a new shared link
   */
  async createLink(params: CreateLinkParams): Promise<TrackedLink> {
    // Enforce policy on expiration and public sharing
    const policy = await this.prisma.policy.findFirst();
    const now = new Date();
    let expires = params.expiresAt;
    if (params.shareType === ShareType.ANYONE) {
      if (!policy?.allowPublicSharing) throw new Error('Public sharing not allowed');
      const maxDays = policy?.maxDurationExternal ?? 30;
      const maxDate = new Date(now);
      maxDate.setDate(maxDate.getDate() + maxDays);
      if (expires) {
        if (expires > maxDate) throw new Error('Expiration date exceeds allowed external limit');
      } else {
        expires = maxDate;
      }
    } else {
      const maxDays = policy?.maxDurationInternal ?? 365;
      const maxDate = new Date(now);
      maxDate.setDate(maxDate.getDate() + maxDays);
      if (expires) {
        if (expires > maxDate) throw new Error('Expiration date exceeds allowed internal limit');
      } else {
        expires = maxDate;
      }
    }
    try {
      const fileId = this._calculateSHA256(params.filePath);
      // Generate a unique link URL
      const linkUrl = this.generateLinkUrl(fileId);
      
      // Create the link in the database
      const link = await this.prisma.trackedLink.create({
        data: {
          fileId: fileId,
          fileName: params.fileName,
          filePath: params.filePath,
          shareType: params.shareType,
          linkUrl,
          expiresAt: expires,
          owner: {
            connect: {
              id: params.ownerId
            }
          },
          recipients: {
            create: params.recipients
          }
        }
      });
      
      // Log the creation for audit purposes
      await logger.audit('link.create', params.ownerId, {
        linkId: link.id,
        fileName: link.fileName,
        shareType: link.shareType,
        recipients: params.recipients
      });
      
      return link;
    } catch (error) {
      logger.error('Failed to create tracked link', error as Error, { params });
      throw error;
    }
  }
  
  /**
   * Get a shared link by ID with role-based access control
   */
  async getLinkById(id: string, user: User): Promise<TrackedLink | null> {
    try {
      const link = await this.prisma.trackedLink.findUnique({
        where: { id },
        include: { recipients: true }
      });
      
      if (!link) {
        return null;
      }
      
      // RBAC: Only allow access if the user is the owner or an admin
      if (user.role !== Role.ADMIN && link.ownerId !== user.id) {
        logger.warn('Unauthorized access attempt to tracked link', {
          userId: user.id,
          linkId: id,
          ownerId: link.ownerId
        });
        return null;
      }
      
      return link;
    } catch (error) {
      logger.error('Failed to get tracked link', error as Error, { id, userId: user.id });
      throw error;
    }
  }
  
  /**
   * Get all shared links with pagination and role-based access control
   */
  async getLinks(user: User, options: LinkQueryOptions = {}): Promise<{ data: TrackedLink[], total: number }> {
    const { page = 1, limit = 10 } = options;
    const skip = (page - 1) * limit;
    
    try {
      // Build the where clause based on user role
      const where = user.role === Role.ADMIN
        ? {} // Admins can see all links
        : { ownerId: user.id }; // Regular users can only see their own links
      
      // Get links with pagination
      const [links, total] = await Promise.all([
        this.prisma.trackedLink.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
          include: { recipients: true }
        }),
        this.prisma.trackedLink.count({ where })
      ]);
      
      return { data: links, total };
    } catch (error) {
      logger.error('Failed to get tracked links', error as Error, { 
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
  async updateLink(id: string, params: UpdateLinkParams, user: User): Promise<TrackedLink | null> {
    try {
      // Enforce policy on expiration updates and public sharing
      const policy = await this.prisma.policy.findFirst();
      if (params.shareType === ShareType.ANYONE && !policy?.allowPublicSharing) {
        throw new Error('Public sharing not allowed');
      }
      if (params.expiresAt) {
        const now = new Date();
        const maxDays = params.shareType === ShareType.ANYONE
          ? policy?.maxDurationExternal ?? 30
          : policy?.maxDurationInternal ?? 365;
        const maxDate = new Date(now);
        maxDate.setDate(maxDate.getDate() + maxDays);
        if (params.expiresAt > maxDate) throw new Error('Expiration date exceeds allowed limit');
      }
       // First check if the link exists and if the user has permission
       const existingLink = await this.getLinkById(id, user);

      if (!existingLink) {
        return null;
      }
      
      // Update the link
      const updatedLink = await this.prisma.trackedLink.update({
        where: { id },
        data: {
          shareType: params.shareType,
          expiresAt: params.expiresAt,
          recipients: {
            deleteMany: {},
            create: params.recipients
          }
        }
      });
      
      // Log the update for audit purposes
      await logger.audit('link.update', user.id, {
        linkId: id,
        updates: params
      });
      
      return updatedLink;
    } catch (error) {
      logger.error('Failed to update tracked link', error as Error, { id, params, userId: user.id });
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
      await this.prisma.trackedLink.delete({
        where: { id }
      });
      
      // Log the deletion for audit purposes
      await logger.audit('link.delete', user.id, {
        linkId: id,
        fileName: existingLink.fileName
      });
      
      return true;
    } catch (error) {
      logger.error('Failed to delete tracked link', error as Error, { id, userId: user.id });
      throw error;
    }
  }
  
  /**
   * Find links that are about to expire for notification purposes
   */
  async findExpiringLinks(daysThreshold: number = 7): Promise<TrackedLink[]> {
    try {
      const now = new Date();
      const thresholdDate = new Date();
      thresholdDate.setDate(now.getDate() + daysThreshold);
      
      // Find links that expire within the threshold period
      const expiringLinks = await this.prisma.trackedLink.findMany({
        where: {
          expiresAt: {
            not: null,
            gt: now,
            lte: thresholdDate
          }
        },
        include: {
          owner: true,
          recipients: true
        }
      });
      
      return expiringLinks;
    } catch (error) {
      logger.error('Failed to find expiring links', error as Error, { daysThreshold });
      throw error;
    }
  }
  
  /**
   * Synchronize all shared links from the source.
   * In a real implementation, this would connect to the Microsoft Graph API
   * to get all shared links and update the database.
   * For now, this is a placeholder.
   */
  async synchronizeLinks(): Promise<void> {
    try {
      logger.info('Starting link synchronization');
      // Placeholder: In a real implementation, you would:
      // 1. Connect to the Microsoft Graph API
      // 2. Get all shared links
      // 3. For each link, check if it exists in the database
      // 4. If it exists, update it
      // 5. If it doesn't exist, create it
      // 6. If a link in the database doesn't exist in the source, delete it
      logger.info('Link synchronization complete');
    } catch (error) {
      logger.error('Failed to synchronize links', error as Error);
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

