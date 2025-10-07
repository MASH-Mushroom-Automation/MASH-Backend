import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

/**
 * Correlation ID Middleware
 * 
 * Features:
 * - Generates unique UUID for each request
 * - Adds correlation ID to request object
 * - Adds correlation ID to response headers
 * - Preserves existing correlation ID from headers
 * - Enables request tracking across services
 */

@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    // Check if correlation ID already exists in headers
    const existingCorrelationId = 
      req.headers['x-correlation-id'] as string ||
      req.headers['x-request-id'] as string;

    // Generate new correlation ID or use existing one
    const correlationId = existingCorrelationId || uuidv4();

    // Attach correlation ID to request object
    req['correlationId'] = correlationId;

    // Add correlation ID to response headers
    res.setHeader('X-Correlation-Id', correlationId);
    res.setHeader('X-Request-Id', correlationId);

    next();
  }
}
