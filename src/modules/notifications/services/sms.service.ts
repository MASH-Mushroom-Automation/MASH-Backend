import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import twilio from 'twilio';
import { Vonage } from '@vonage/server-sdk';

export interface SMSMessage {
  to: string;
  body: string;
  from?: string;
}

export interface SMSDeliveryResult {
  success: boolean;
  messageId?: string;
  provider: 'twilio' | 'vonage';
  error?: string;
  cost?: number;
  status: 'sent' | 'failed' | 'queued';
}

export interface SMSProviderHealth {
  provider: string;
  healthy: boolean;
  lastChecked: Date;
  responseTime?: number;
  error?: string;
}

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);

  private twilioClient: twilio.Twilio;
  private vonageClient: Vonage;
  private providerPriority: string[] = ['twilio', 'nexmo'];
  private providerHealth: Map<string, SMSProviderHealth> = new Map();

  constructor(private readonly configService: ConfigService) {
    this.initializeProviders();
    this.initializeProviderHealth();
  }

  /**
   * Initialize SMS providers
   */
  private initializeProviders(): void {
    // Initialize Twilio
    const twilioAccountSid = this.configService.get<string>('TWILIO_ACCOUNT_SID');
    const twilioAuthToken = this.configService.get<string>('TWILIO_AUTH_TOKEN');

    if (twilioAccountSid && twilioAuthToken) {
      this.twilioClient = twilio(twilioAccountSid, twilioAuthToken);
      this.logger.log('✅ Twilio SMS provider initialized');
    } else {
      this.logger.warn('⚠️ Twilio credentials not configured - Twilio SMS disabled');
    }

    // Initialize Nexmo (now Vonage)
    const vonageApiKey =
      this.configService.get<string>('VONAGE_API_KEY') ||
      this.configService.get<string>('NEXMO_API_KEY');
    const vonageApiSecret =
      this.configService.get<string>('VONAGE_API_SECRET') ||
      this.configService.get<string>('NEXMO_API_SECRET');

    if (vonageApiKey && vonageApiSecret) {
      this.vonageClient = new Vonage({
        apiKey: vonageApiKey,
        apiSecret: vonageApiSecret,
      });
      this.logger.log('✅ Vonage SMS provider initialized');
    } else {
      this.logger.warn('⚠️ Vonage credentials not configured - Vonage SMS disabled');
    }

    // Set provider priority
    const priorityConfig = this.configService.get<string>('SMS_PROVIDER_PRIORITY', 'twilio,nexmo');
    this.providerPriority = priorityConfig.split(',').map(p => p.trim());
    this.logger.log(`📋 SMS provider priority: ${this.providerPriority.join(' → ')}`);
  }

  /**
   * Initialize provider health monitoring
   */
  private initializeProviderHealth(): void {
    this.providerHealth.set('twilio', {
      provider: 'twilio',
      healthy: !!this.twilioClient,
      lastChecked: new Date(),
    });

    this.providerHealth.set('vonage', {
      provider: 'vonage',
      healthy: !!this.vonageClient,
      lastChecked: new Date(),
    });
  }

  /**
   * Send SMS message with automatic provider failover
   */
  async sendSMS(message: SMSMessage): Promise<SMSDeliveryResult> {
    const startTime = Date.now();

    // Validate message
    if (!message.to || !message.body) {
      return {
        success: false,
        provider: 'twilio',
        error: 'Missing required fields: to and body',
        status: 'failed',
      };
    }

    // Try providers in priority order
    for (const provider of this.providerPriority) {
      try {
        const result = await this.sendWithProvider(provider, message);
        const responseTime = Date.now() - startTime;

        // Update provider health
        this.updateProviderHealth(provider, true, responseTime);

        if (result.success) {
          this.logger.log(
            `✅ SMS sent successfully via ${provider} to ${message.to} (${responseTime}ms)`,
          );
          return result;
        }
      } catch (error) {
        const responseTime = Date.now() - startTime;
        this.updateProviderHealth(provider, false, responseTime, error.message);
        this.logger.warn(`⚠️ SMS failed via ${provider}: ${error.message}`);

        // Continue to next provider
        continue;
      }
    }

    // All providers failed
    return {
      success: false,
      provider: this.providerPriority[0] as 'twilio' | 'vonage',
      error: 'All SMS providers failed',
      status: 'failed',
    };
  }

  /**
   * Send SMS using specific provider
   */
  private async sendWithProvider(
    provider: string,
    message: SMSMessage,
  ): Promise<SMSDeliveryResult> {
    switch (provider) {
      case 'twilio':
        return this.sendWithTwilio(message);
      case 'vonage':
        return this.sendWithVonage(message);
      default:
        throw new Error(`Unknown SMS provider: ${provider}`);
    }
  }

  /**
   * Send SMS via Twilio
   */
  private async sendWithTwilio(message: SMSMessage): Promise<SMSDeliveryResult> {
    if (!this.twilioClient) {
      throw new Error('Twilio client not initialized');
    }

    const from = message.from || this.configService.get<string>('TWILIO_PHONE_NUMBER');
    if (!from) {
      throw new Error('Twilio phone number not configured');
    }

    try {
      const twilioMessage = await this.twilioClient.messages.create({
        body: message.body,
        from: from,
        to: message.to,
      });

      return {
        success: true,
        messageId: twilioMessage.sid,
        provider: 'twilio',
        cost: parseFloat(twilioMessage.price || '0'),
        status: twilioMessage.status === 'sent' ? 'sent' : 'queued',
      };
    } catch (error) {
      throw new Error(`Twilio error: ${error.message}`);
    }
  }

  /**
   * Send SMS via Vonage (formerly Nexmo)
   */
  private async sendWithVonage(message: SMSMessage): Promise<SMSDeliveryResult> {
    if (!this.vonageClient) {
      throw new Error('Vonage client not initialized');
    }

    const from = message.from || this.configService.get<string>('VONAGE_PHONE_NUMBER', 'MASH');

    try {
      const result = await this.vonageClient.sms.send({
        to: message.to,
        from: from,
        text: message.body,
      });

      // Vonage returns an array of message results
      const msg = result.messages[0];

      return {
        success: msg.status === '0', // 0 = success in Vonage
        messageId: msg['message-id'],
        provider: 'vonage',
        status: msg.status === '0' ? 'sent' : 'failed',
        error: msg.status !== '0' ? msg['error-text'] : undefined,
      };
    } catch (error) {
      throw new Error(`Vonage error: ${error.message}`);
    }
  }

  /**
   * Get SMS delivery status
   */
  async getDeliveryStatus(messageId: string, provider?: 'twilio' | 'nexmo'): Promise<any> {
    if (provider === 'twilio' && this.twilioClient) {
      try {
        const message = await this.twilioClient.messages(messageId).fetch();
        return {
          messageId,
          provider: 'twilio',
          status: message.status,
          to: message.to,
          from: message.from,
          dateSent: message.dateSent,
          dateCreated: message.dateCreated,
          price: message.price,
        };
      } catch (error) {
        throw new Error(`Failed to get Twilio message status: ${error.message}`);
      }
    }

    // For Nexmo, we don't have a direct status API, so return cached info
    if (provider === 'nexmo') {
      return {
        messageId,
        provider: 'nexmo',
        status: 'unknown',
        note: 'Nexmo delivery status not available via API',
      };
    }

    throw new Error('Provider not specified or not supported');
  }

  /**
   * Get provider health status
   */
  getProviderHealth(): SMSProviderHealth[] {
    return Array.from(this.providerHealth.values());
  }

  /**
   * Update provider health status
   */
  private updateProviderHealth(
    provider: string,
    healthy: boolean,
    responseTime?: number,
    error?: string,
  ): void {
    const health = this.providerHealth.get(provider);
    if (health) {
      health.healthy = healthy;
      health.lastChecked = new Date();
      health.responseTime = responseTime;
      health.error = error;
    }
  }

  /**
   * Test SMS delivery to a phone number
   */
  async testSMS(phoneNumber: string, customMessage?: string): Promise<SMSDeliveryResult> {
    const message: SMSMessage = {
      to: phoneNumber,
      body:
        customMessage ||
        `Test SMS from MASH Device Monitoring System at ${new Date().toISOString()}`,
    };

    this.logger.log(`🧪 Testing SMS delivery to ${phoneNumber}`);
    return this.sendSMS(message);
  }

  /**
   * Check if SMS service is available
   */
  isAvailable(): boolean {
    return this.providerPriority.some(provider => {
      const health = this.providerHealth.get(provider);
      return health?.healthy;
    });
  }

  /**
   * Get SMS rate limit per minute
   */
  getRateLimit(): number {
    return this.configService.get<number>('SMS_RATE_LIMIT_PER_MINUTE', 10);
  }

  /**
   * Get SMS delivery timeout
   */
  getDeliveryTimeout(): number {
    return this.configService.get<number>('SMS_DELIVERY_TIMEOUT', 30000);
  }
}
