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