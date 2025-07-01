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
 * Get all links with pagination and RBAC
 * 
 * GET /api/v1/links?page=1&limit=10
 */
export async function GET(request: NextRequest) {
  try {
    // Get the authenticated user from the session
    const session = await getServerSession();
    
    if (!session?.user) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    
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
    
    // Get links with RBAC applied
    const { data: links, total } = await linkService.getLinks(user, { page, limit });
    
    // Log the request
    logger.info('Retrieved links', {
      userId: user.id,
      role: user.role,
      count: links.length,
      total,
      page,
      limit
    });
    
    // Return the links with pagination info
    return NextResponse.json({
      success: true,
      data: links,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    logger.error('Failed to get links', error as Error);
    
    return NextResponse.json(
      { success: false, message: 'Failed to get links', error: (error as Error).message },
      { status: 500 }
    );
  }
}

/**
 * Create a new shared link
 * 
 * POST /api/v1/links
 */
export async function POST(request: NextRequest) {
  try {
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
    
    // Validate required fields
    const requiredFields = ['fileId', 'fileName', 'filePath', 'sharedWith', 'scope'];
    for (const field of requiredFields) {
      if (!body[field]) {
        return NextResponse.json(
          { success: false, message: `Missing required field: ${field}` },
          { status: 400 }
        );
      }
    }
    
    // Validate scope
    if (!Object.values(ShareScope).includes(body.scope)) {
      return NextResponse.json(
        { success: false, message: `Invalid scope: ${body.scope}. Must be one of: ${Object.values(ShareScope).join(', ')}` },
        { status: 400 }
      );
    }
    
    // Parse expiresAt if provided
    let expiresAt: Date | undefined = undefined;
    if (body.expiresAt) {
      expiresAt = new Date(body.expiresAt);
      if (isNaN(expiresAt.getTime())) {
        return NextResponse.json(
          { success: false, message: 'Invalid expiresAt date format' },
          { status: 400 }
        );
      }
    }
    
    // Create the link
    const link = await linkService.createLink({
      fileId: body.fileId,
      fileName: body.fileName,
      filePath: body.filePath,
      sharedWith: body.sharedWith,
      scope: body.scope,
      expiresAt,
      ownerId: user.id
    });
    
    // Log the creation
    logger.info('Created new shared link', {
      userId: user.id,
      linkId: link.id,
      fileName: link.fileName
    });
    
    // Return the created link
    return NextResponse.json(
      { success: true, data: link },
      { status: 201 }
    );
  } catch (error) {
    logger.error('Failed to create shared link', error as Error);
    
    return NextResponse.json(
      { success: false, message: 'Failed to create shared link', error: (error as Error).message },
      { status: 500 }
    );
  }
}