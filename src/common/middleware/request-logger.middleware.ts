import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

/**
 * Request Logger Middleware
 *
 * Features:
 * - Logs all incoming requests
 * - Captures request metadata (method, URL, IP, user agent)
 * - Adds start time to request object for duration calculation
 * - Lightweight and fast
 */

@Injectable()
export class RequestLoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger(RequestLoggerMiddleware.name);

  use(req: Request, res: Response, next: NextFunction) {
    const { method, originalUrl, ip } = req;
    const userAgent = req.get('user-agent') || 'Unknown';
    const correlationId = req['correlationId'] || 'N/A';

    // Add start time to request for duration calculation
    req['startTime'] = Date.now();

    // Log incoming request
    this.logger.log(
      `${method} ${originalUrl} - ${ip} - ${userAgent} [${correlationId}]`,
    );

    // Log request completion
    res.on('finish', () => {
      const { statusCode } = res;
      const duration = Date.now() - req['startTime'];

      const logMessage = `${method} ${originalUrl} ${statusCode} ${duration}ms [${correlationId}]`;

      // Log level based on status code
      if (statusCode >= 500) {
        this.logger.error(logMessage);
      } else if (statusCode >= 400) {
        this.logger.warn(logMessage);
      } else {
        this.logger.log(logMessage);
      }
    });

    next();
  }
}
