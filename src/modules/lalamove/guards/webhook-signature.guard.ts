import { Injectable, CanActivate, ExecutionContext, UnauthorizedException, Logger } from '@nestjs/common';
import { Request } from 'express';
import { LalamoveApiService } from '../services/lalamove-api.service';
import { API_CONFIG } from '../constants/lalamove.constants';

/**
 * WebhookSignatureGuard
 * Verifies HMAC SHA-256 signature for Lalamove webhook requests
 * Protects webhook endpoint from unauthorized access
 */
@Injectable()
export class WebhookSignatureGuard implements CanActivate {
  private readonly logger = new Logger(WebhookSignatureGuard.name);

  constructor(private readonly lalamoveApi: LalamoveApiService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();

    try {
      // Extract signature and timestamp from headers
      const signature = request.headers['x-lalamove-signature'] as string;
      const timestamp = request.headers['x-lalamove-timestamp'] as string;

      if (!signature || !timestamp) {
        this.logger.warn('Missing webhook signature or timestamp');
        throw new UnauthorizedException('Missing webhook authentication headers');
      }

      // Check timestamp freshness (prevent replay attacks)
      const requestTime = parseInt(timestamp, 10);
      const currentTime = Date.now();
      const timeDifferenceMinutes = (currentTime - requestTime) / 1000 / 60;

      if (timeDifferenceMinutes > API_CONFIG.WEBHOOK_SIGNATURE_EXPIRY_MINUTES) {
        this.logger.warn(`Webhook timestamp expired: ${timeDifferenceMinutes} minutes old`);
        throw new UnauthorizedException('Webhook timestamp expired');
      }

      // Get raw body as string for signature verification
      const rawBody = JSON.stringify(request.body);

      // Verify signature
      const isValid = this.lalamoveApi.verifyWebhookSignature(signature, timestamp, rawBody);

      if (!isValid) {
        this.logger.error('Invalid webhook signature');
        throw new UnauthorizedException('Invalid webhook signature');
      }

      this.logger.debug('Webhook signature verified successfully');
      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }

      this.logger.error(`Webhook signature verification failed: ${error.message}`);
      throw new UnauthorizedException('Webhook signature verification failed');
    }
  }
}
