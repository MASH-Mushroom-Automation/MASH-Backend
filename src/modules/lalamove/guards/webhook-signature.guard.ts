import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { WEBHOOK_SIGNATURE_EXPIRY_MINUTES } from '../constants/lalamove.constants';

/**
 * WebhookSignatureGuard
 * Verifies Lalamove webhook signatures to prevent unauthorized webhook calls
 * 
 * Validates:
 * 1. Signature header exists
 * 2. Timestamp header exists and is recent (within 5 minutes)
 * 3. Signature matches expected HMAC SHA-256
 */
@Injectable()
export class WebhookSignatureGuard implements CanActivate {
  private readonly logger = new Logger(WebhookSignatureGuard.name);
  private readonly secret: string;

  constructor(private readonly configService: ConfigService) {
    this.secret = this.configService.get<string>('LALAMOVE_SECRET');
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    
    const signature = request.headers['x-lalamove-signature'];
    const timestamp = request.headers['x-lalamove-timestamp'];

    // Check if headers exist
    if (!signature || !timestamp) {
      this.logger.warn('Missing webhook signature or timestamp headers');
      throw new UnauthorizedException('Missing webhook authentication headers');
    }

    // Verify timestamp (prevent replay attacks)
    const now = Date.now();
    const requestTime = parseInt(timestamp, 10) * 1000; // Convert to milliseconds
    const timeDifference = Math.abs(now - requestTime);
    const maxAge = WEBHOOK_SIGNATURE_EXPIRY_MINUTES * 60 * 1000;

    if (timeDifference > maxAge) {
      this.logger.warn(`Webhook timestamp expired: ${timeDifference}ms old`);
      throw new UnauthorizedException('Webhook timestamp expired');
    }

    // Verify signature
    const body = JSON.stringify(request.body);
    const expectedSignature = this.generateWebhookSignature(timestamp, body);

    if (signature !== expectedSignature) {
      this.logger.warn('Invalid webhook signature');
      throw new UnauthorizedException('Invalid webhook signature');
    }

    this.logger.log('✅ Webhook signature verified');
    return true;
  }

  /**
   * Generate expected webhook signature
   * Format: HMAC SHA-256 of timestamp + body
   */
  private generateWebhookSignature(timestamp: string, body: string): string {
    const rawSignature = `${timestamp}${body}`;
    
    return crypto
      .createHmac('sha256', this.secret)
      .update(rawSignature)
      .digest('hex');
  }
}
