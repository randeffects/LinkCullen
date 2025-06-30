import { expiringLinksNotifier } from '@/jobs/expiringLinksNotifier';
import { logger } from '@/lib/logger';

/**
 * Initialize background jobs and services when the API starts
 */
export function initializeServices(): void {
  try {
    logger.info('Initializing background services');
    
    // Start the expiring links notification job
    expiringLinksNotifier.start();
    
    logger.info('Background services initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize background services', error as Error);
    // Don't throw the error - we want the API to start even if job initialization fails
  }
}

// Export a function to manually trigger the expiring links notification job
// This can be used for testing or administrative purposes
export async function triggerExpiringLinksNotification(): Promise<void> {
  try {
    logger.info('Manually triggering expiring links notification');
    await expiringLinksNotifier.runNow();
    return Promise.resolve();
  } catch (error) {
    logger.error('Failed to manually trigger expiring links notification', error as Error);
    return Promise.reject(error);
  }
}