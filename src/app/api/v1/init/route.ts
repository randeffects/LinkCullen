import { NextRequest, NextResponse } from 'next/server';
import { initializeServices } from '../startup';
import { logger } from '@/lib/logger';

// Initialize services when this module is loaded
try {
  initializeServices();
  logger.info('Services initialized during API startup');
} catch (error) {
  logger.error('Failed to initialize services during API startup', error as Error);
}

/**
 * API route to manually initialize services
 * This can be useful for serverless environments where the API might not stay initialized
 * 
 * GET /api/v1/init
 */
export async function GET(request: NextRequest) {
  try {
    // Check for admin authorization
    // In a real implementation, this would use a proper authorization check
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    // Re-initialize services
    initializeServices();
    
    logger.info('Services manually initialized via API', {
      ip: request.headers.get('x-forwarded-for') || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown'
    });
    
    return NextResponse.json(
      { success: true, message: 'Services initialized successfully' },
      { status: 200 }
    );
  } catch (error) {
    logger.error('Failed to initialize services via API', error as Error);
    
    return NextResponse.json(
      { success: false, message: 'Failed to initialize services', error: (error as Error).message },
      { status: 500 }
    );
  }
}