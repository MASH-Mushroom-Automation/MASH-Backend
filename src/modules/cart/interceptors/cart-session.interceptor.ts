import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Logger } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Response } from 'express';
import { randomBytes } from 'crypto';

/**
 * CartSessionInterceptor
 * Handles guest cart session management
 * - Generates session ID for guest users
 * - Sets session cookie with 7-day expiry
 * - Preserves session ID across requests
 */
@Injectable()
export class CartSessionInterceptor implements NestInterceptor {
  private readonly logger = new Logger(CartSessionInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const ctx = context.switchToHttp();
    const request = ctx.getRequest();
    const response = ctx.getResponse<Response>();

    // Check if user is authenticated
    const userId = request.user?.id;

    // If authenticated, no need for session tracking
    if (userId) {
      return next.handle();
    }

    // Get or generate session ID for guest users
    let sessionId = request.cookies?.['cart_session_id'] || request.headers['x-session-id'];

    if (!sessionId) {
      // Generate new session ID
      sessionId = this.generateSessionId();
      this.logger.log(`Generated new guest session: ${sessionId}`);
    }

    // Set session ID in request for downstream handlers
    request.headers['x-session-id'] = sessionId;

    return next.handle().pipe(
      tap(() => {
        // Set session cookie in response
        if (!request.cookies?.['cart_session_id']) {
          const isProduction = process.env.NODE_ENV === 'production';
          response.cookie('cart_session_id', sessionId, {
            httpOnly: true,
            secure: isProduction, // Required for sameSite: 'none'
            sameSite: isProduction ? 'none' : 'lax', // 'none' for cross-domain in production
            maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
            path: '/',
            domain: isProduction ? '.mashmarket.app' : undefined, // Share across subdomains
          });

          this.logger.debug(`Set cart session cookie: ${sessionId}`);
        }
      }),
    );
  }

  /**
   * Generate a secure random session ID
   */
  private generateSessionId(): string {
    return `guest_${randomBytes(16).toString('hex')}`;
  }
}
