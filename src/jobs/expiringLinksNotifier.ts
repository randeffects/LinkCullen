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

import cron from 'node-cron';
import nodemailer from 'nodemailer';
import { linkService } from '@/services/linkService';
import { logger } from '@/lib/logger';

interface EmailConfig {
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
  from: string;
}

/**
 * Service to send notifications for links that are about to expire
 */
export class ExpiringLinksNotifier {
  private emailConfig: EmailConfig;
  private daysThreshold: number;
  private cronSchedule: string;
  private transporter: nodemailer.Transporter;
  private isRunning: boolean = false;

  /**
   * Initialize the notifier with configuration
   */
  constructor(
    emailConfig: EmailConfig = {
      host: process.env.EMAIL_HOST || 'smtp.example.com',
      port: parseInt(process.env.EMAIL_PORT || '587'),
      secure: process.env.EMAIL_SECURE === 'true',
      auth: {
        user: process.env.EMAIL_USER || 'user@example.com',
        pass: process.env.EMAIL_PASSWORD || 'password'
      },
      from: process.env.EMAIL_FROM || 'noreply@cullenlinks.com'
    },
    daysThreshold: number = parseInt(process.env.EXPIRATION_NOTIFICATION_DAYS || '7'),
    cronSchedule: string = process.env.EXPIRATION_CRON_SCHEDULE || '0 9 * * *' // Default: every day at 9 AM
  ) {
    this.emailConfig = emailConfig;
    this.daysThreshold = daysThreshold;
    this.cronSchedule = cronSchedule;
    
    // Create email transporter
    this.transporter = nodemailer.createTransport({
      host: this.emailConfig.host,
      port: this.emailConfig.port,
      secure: this.emailConfig.secure,
      auth: {
        user: this.emailConfig.auth.user,
        pass: this.emailConfig.auth.pass
      }
    });
  }

  /**
   * Start the scheduled job
   */
  start(): void {
    if (this.isRunning) {
      logger.warn('Expiring links notifier is already running');
      return;
    }

    logger.info('Starting expiring links notifier', {
      cronSchedule: this.cronSchedule,
      daysThreshold: this.daysThreshold
    });

    // Schedule the job
    cron.schedule(this.cronSchedule, async () => {
      try {
        await this.checkAndNotify();
      } catch (error) {
        logger.error('Error in expiring links notification job', error as Error);
      }
    });

    this.isRunning = true;
  }

  /**
   * Manually trigger the notification job immediately
   */
  async runNow(): Promise<void> {
    await this.checkAndNotify();
  }

  /**
   * Check for expiring links and send notifications
   */
  async checkAndNotify(): Promise<void> {
    try {
      logger.info('Checking for expiring links', { daysThreshold: this.daysThreshold });
      
      // Get links that are about to expire
      const expiringLinks = await linkService.findExpiringLinks(this.daysThreshold);
      
      if (expiringLinks.length === 0) {
        logger.info('No expiring links found');
        return;
      }
      
      logger.info(`Found ${expiringLinks.length} expiring links`);
      
      // Group links by owner for consolidated emails
      const linksByOwner = expiringLinks.reduce((acc, link) => {
        const ownerKey = link.owner.id;
        if (!acc[ownerKey]) {
          acc[ownerKey] = { owner: link.owner, links: [] };
        }
        acc[ownerKey].links.push(link);
        return acc;
      }, {} as Record<string, { owner: { id: string; email: string }, links: typeof expiringLinks }>);

      // Send notifications to each owner
      for (const ownerId in linksByOwner) {
        const { owner, links } = linksByOwner[ownerId];
        await this.sendExpirationNotification(owner, links);
      }
      
      logger.info('Expiring links notification job completed successfully');
    } catch (error) {
      logger.error('Failed to process expiring links notifications', error as Error);
      throw error;
    }
  }

  /**
   * Send an email notification for expiring links
   */
  private async sendExpirationNotification(owner: any, links: any[]): Promise<void> {
    try {
      // Create email content
      const subject = `CullenLinks: You have ${links.length} shared link(s) expiring soon`;
      
      // Build the HTML content
      let htmlContent = `
        <h2>Shared Links Expiring Soon</h2>
        <p>Hello ${owner.email},</p>
        <p>The following shared links are about to expire:</p>
        <table border="1" cellpadding="5" style="border-collapse: collapse;">
          <tr>
            <th>File Name</th>
            <th>Shared With</th>
            <th>Expiration Date</th>
            <th>Action</th>
          </tr>
      `;
      
      // Add each link to the table
      links.forEach(link => {
        const expirationDate = link.expiresAt ? new Date(link.expiresAt).toLocaleDateString() : 'N/A';
        const sharedWith = link.recipients.map(r => r.recipient).join(', ');
        htmlContent += `
          <tr>
            <td>${link.fileName}</td>
            <td>${sharedWith}</td>
            <td>${expirationDate}</td>
            <td><a href="${process.env.NEXT_PUBLIC_BASE_URL}/links/${link.id}">Manage Link</a></td>
          </tr>
        `;
      });
      
      // Close the table and add footer
      htmlContent += `
        </table>
        <p>To extend these links, please visit the CullenLinks dashboard.</p>
        <p>Thank you,<br>CullenLinks Team</p>
      `;
      
      // Send the email
      await this.transporter.sendMail({
        from: this.emailConfig.from,
        to: owner.email,
        subject,
        html: htmlContent
      });
      
      logger.info('Sent expiration notification email', {
        userId: owner.id,
        email: owner.email,
        linkCount: links.length
      });
    } catch (error) {
      logger.error('Failed to send expiration notification email', error as Error, {
        userId: owner.id,
        linkCount: links.length
      });
    }
  }
}

// Create and export a singleton instance
export const expiringLinksNotifier = new ExpiringLinksNotifier();

// Export the class for testing or custom instances
export default ExpiringLinksNotifier;

