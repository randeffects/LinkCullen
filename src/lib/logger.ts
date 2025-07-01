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

/**
 * Structured JSON logger for Datadog integration
 * 
 * This logger creates structured JSON logs that can be easily parsed by Datadog.
 * It includes standard fields like timestamp, level, message, and service,
 * as well as custom fields for request context and additional metadata.
 */
import crypto from 'crypto';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  [key: string]: any;
}

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  service: string;
  environment: string;
  requestId?: string;
  userId?: string;
  path?: string;
  method?: string;
  statusCode?: number;
  duration?: number;
  context?: LogContext;
}

class Logger {
  private serviceName: string;
  private environment: string;

  constructor(serviceName: string = 'cullenlinks', environment: string = process.env.NODE_ENV || 'development') {
    this.serviceName = serviceName;
    this.environment = environment;
  }

  /**
   * Create a log entry with the specified level
   */
  private log(level: LogLevel, message: string, context?: LogContext): void {
    const logEntry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      service: this.serviceName,
      environment: this.environment,
      context
    };

    // Output as JSON string for Datadog parsing
    console.log(JSON.stringify(logEntry));
  }

  /**
   * Log debug message
   */
  debug(message: string, context?: LogContext): void {
    this.log('debug', message, context);
  }

  /**
   * Log info message
   */
  info(message: string, context?: LogContext): void {
    this.log('info', message, context);
  }

  /**
   * Log warning message
   */
  warn(message: string, context?: LogContext): void {
    this.log('warn', message, context);
  }

  /**
   * Log error message
   */
  error(message: string, error?: Error, context?: LogContext): void {
    const errorContext = {
      ...context,
      error: error ? {
        name: error.name,
        message: error.message,
        stack: error.stack
      } : undefined
    };

    this.log('error', message, errorContext);
  }

  /**
   * Create a request logger middleware for Next.js API routes
   */
  createRequestLogger() {
    return async (req: any, res: any, next: () => Promise<void>) => {
      const start = Date.now();
      const requestId = req.headers['x-request-id'] || crypto.randomUUID();

      // Add requestId to response headers
      res.setHeader('x-request-id', requestId);

      // Create request context
      const requestContext = {
        requestId,
        userId: req.session?.user?.id,
        path: req.url,
        method: req.method,
        userAgent: req.headers['user-agent'],
        ip: req.headers['x-forwarded-for'] || req.connection.remoteAddress
      };

      // Log request start
      this.info(`API Request: ${req.method} ${req.url}`, requestContext);

      // Capture response
      const originalEnd = res.end;
      res.end = (...args: any[]) => {
        const duration = Date.now() - start;

        // Log request completion
        this.info(`API Response: ${req.method} ${req.url}`, {
          ...requestContext,
          statusCode: res.statusCode,
          duration
        });

        return originalEnd.apply(res, args);
      };

      await next();
    };
  }

  /**
   * Log audit events to both console and database
   */
  async audit(action: string, userId: string, details: any): Promise<void> {
    // Log to console in structured format
    this.info(`AUDIT: ${action}`, {
      audit: true,
      userId,
      action,
      details
    });

    // In a real implementation, this would also save to the database
    // This is a placeholder for the actual implementation
    try {
      // Example of how this would work with Prisma
      // await prisma.auditLog.create({
      //   data: {
      //     action,
      //     userId,
      //     details
      //   }
      // });
    } catch (error) {
      this.error('Failed to save audit log to database', error as Error);
    }
  }
}

// Export a singleton instance
export const logger = new Logger();

// Export the class for testing or custom instances
export default Logger;
