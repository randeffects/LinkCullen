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
import { PrismaClient, Role } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Trigger a manual synchronization of all shared links
 * 
 * POST /api/v1/sync
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
    
    // RBAC: Only allow access if the user is an admin
    if (user.role !== Role.ADMIN) {
      logger.warn('Unauthorized sync attempt', {
        userId: user.id,
      });
      return NextResponse.json(
        { success: false, message: 'Forbidden' },
        { status: 403 }
      );
    }
    
    // Trigger the synchronization process (asynchronous)
    linkService.synchronizeLinks().then(() => {
        logger.info('Link synchronization completed successfully');
    }).catch(error => {
        logger.error('Link synchronization failed', error);
    });
    
    // Log the action
    logger.info('Triggered manual link synchronization', {
      userId: user.id,
    });
    
    // Return an immediate response
    return NextResponse.json(
      { success: true, message: 'Synchronization started' },
      { status: 202 }
    );
  } catch (error) {
    logger.error('Failed to start synchronization', error as Error);
    
    return NextResponse.json(
      { success: false, message: 'Failed to start synchronization', error: (error as Error).message },
      { status: 500 }
    );
  }
}
