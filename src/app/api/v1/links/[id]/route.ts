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

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { linkService } from '@/services/linkService';
import { logger } from '@/lib/logger';
import { PrismaClient, ShareScope } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Get a specific shared link by ID
 * 
 * GET /api/v1/links/:id
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    
    // Get the authenticated user from the session
    const session = await getServerSession();
    
    if (!session?.user) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    // Get the user from the database
    const user = await prisma.user.findUnique({
      where: { email: session.user.email as string }
    });
    
    if (!user) {
      logger.warn('User not found in database', { email: session.user.email });
      return NextResponse.json(
        { success: false, message: 'User not found' },
        { status: 404 }
      );
    }
    
    // Get the link with RBAC applied
    const link = await linkService.getLinkById(id, user);
    
    if (!link) {
      return NextResponse.json(
        { success: false, message: 'Link not found or access denied' },
        { status: 404 }
      );
    }
    
    // Log the request
    logger.info('Retrieved link by ID', {
      userId: user.id,
      linkId: id
    });
    
    // Return the link
    return NextResponse.json({
      success: true,
      data: link
    });
  } catch (error) {
    logger.error('Failed to get link by ID', error as Error);
    
    return NextResponse.json(
      { success: false, message: 'Failed to get link', error: (error as Error).message },
      { status: 500 }
    );
  }
}

/**
 * Update a specific shared link
 * 
 * PUT /api/v1/links/:id
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    
    // Get the authenticated user from the session
    const session = await getServerSession();
    
    if (!session?.user) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    // Get the user from the database
    const user = await prisma.user.findUnique({
      where: { email: session.user.email as string }
    });
    
    if (!user) {
      logger.warn('User not found in database', { email: session.user.email });
      return NextResponse.json(
        { success: false, message: 'User not found' },
        { status: 404 }
      );
    }
    
    // Parse the request body
    const body = await request.json();
    
    // Validate scope if provided
    if (body.scope && !Object.values(ShareScope).includes(body.scope)) {
      return NextResponse.json(
        { success: false, message: `Invalid scope: ${body.scope}. Must be one of: ${Object.values(ShareScope).join(', ')}` },
        { status: 400 }
      );
    }
    
    // Parse expiresAt if provided
    let expiresAt: Date | null | undefined = undefined;
    if (body.expiresAt === null) {
      expiresAt = null; // Allow removing the expiration date
    } else if (body.expiresAt) {
      expiresAt = new Date(body.expiresAt);
      if (isNaN(expiresAt.getTime())) {
        return NextResponse.json(
          { success: false, message: 'Invalid expiresAt date format' },
          { status: 400 }
        );
      }
    }
    
    // Update the link
    const updatedLink = await linkService.updateLink(
      id,
      {
        sharedWith: body.sharedWith,
        scope: body.scope,
        expiresAt
      },
      user
    );
    
    if (!updatedLink) {
      return NextResponse.json(
        { success: false, message: 'Link not found or access denied' },
        { status: 404 }
      );
    }
    
    // Log the update
    logger.info('Updated shared link', {
      userId: user.id,
      linkId: id
    });
    
    // Return the updated link
    return NextResponse.json({
      success: true,
      data: updatedLink
    });
  } catch (error) {
    logger.error('Failed to update shared link', error as Error);
    
    return NextResponse.json(
      { success: false, message: 'Failed to update shared link', error: (error as Error).message },
      { status: 500 }
    );
  }
}

/**
 * Delete a specific shared link
 * 
 * DELETE /api/v1/links/:id
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    
    // Get the authenticated user from the session
    const session = await getServerSession();
    
    if (!session?.user) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    // Get the user from the database
    const user = await prisma.user.findUnique({
      where: { email: session.user.email as string }
    });
    
    if (!user) {
      logger.warn('User not found in database', { email: session.user.email });
      return NextResponse.json(
        { success: false, message: 'User not found' },
        { status: 404 }
      );
    }
    
    // Delete the link
    const success = await linkService.deleteLink(id, user);
    
    if (!success) {
      return NextResponse.json(
        { success: false, message: 'Link not found or access denied' },
        { status: 404 }
      );
    }
    
    // Log the deletion
    logger.info('Deleted shared link', {
      userId: user.id,
      linkId: id
    });
    
    // Return success with no content
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    logger.error('Failed to delete shared link', error as Error);
    
    return NextResponse.json(
      { success: false, message: 'Failed to delete shared link', error: (error as Error).message },
      { status: 500 }
    );
  }
}