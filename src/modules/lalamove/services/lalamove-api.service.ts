import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import * as crypto from 'crypto';
import {
  LalamoveQuotationRequest,
  LalamoveQuotationResponse,
} from '../interfaces/lalamove-quotation.interface';
import {
  LalamoveOrderRequest,
  LalamoveOrderResponse,
  LalamoveDriverResponse,
  LalalovePriorityFeeRequest,
  LalalovePriorityFeeResponse,
} from '../interfaces/lalamove-order.interface';
import { WebhookSetupRequest, WebhookSetupResponse } from '../interfaces/lalamove-webhook.interface';

/**
 * LalamoveApiService
 * Handles direct API communication with Lalamove
 * Implements HMAC SHA-256 authentication
 */
@Injectable()
export class LalamoveApiService {
  private readonly logger = new Logger(LalamoveApiService.name);
  private readonly apiKey: string;
  private readonly apiSecret: string;
  private readonly apiHost: string;
  private readonly market: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.apiKey = this.configService.get<string>('LALAMOVE_API_KEY');
    this.apiSecret = this.configService.get<string>('LALAMOVE_API_SECRET');
    this.apiHost = this.configService.get<string>('LALAMOVE_HOST');
    this.market = this.configService.get<string>('LALAMOVE_MARKET', 'PH');

    if (!this.apiKey || !this.apiSecret || !this.apiHost) {
      throw new Error('Lalamove credentials not configured in environment variables');
    }
  }

  /**
   * Generate HMAC SHA-256 signature for API authentication
   */
  private generateSignature(timestamp: string, method: string, path: string, body?: any): string {
    const rawSignature = `${timestamp}\r\n${method}\r\n${path}\r\n\r\n${body ? JSON.stringify(body) : ''}`;
    
    const signature = crypto
      .createHmac('sha256', this.apiSecret)
      .update(rawSignature)
      .digest('hex');

    this.logger.debug(`Generated signature for ${method} ${path}`);
    return signature;
  }

  /**
   * Make authenticated request to Lalamove API
   */
  private async makeRequest<T>(
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
    path: string,
    body?: any,
  ): Promise<T> {
    const timestamp = Date.now().toString();
    const signature = this.generateSignature(timestamp, method, path, body);

    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `hmac ${this.apiKey}:${timestamp}:${signature}`,
      'Market': this.market,
      'Accept': 'application/json',
    };

    const url = `${this.apiHost}${path}`;

    try {
      this.logger.log(`${method} ${url}`);
      
      const response = await firstValueFrom(
        this.httpService.request<T>({
          method,
          url,
          headers,
          data: body,
          timeout: 30000,
        }),
      );

      return response.data;
    } catch (error) {
      this.logger.error(`Lalamove API error: ${error.message}`, error.response?.data);
      throw error;
    }
  }

  /**
   * Get city information for Philippines
   */
  async getCityInfo(): Promise<any> {
    return this.makeRequest('GET', `/v3/cities`);
  }

  /**
   * Create quotation
   */
  async createQuotation(data: LalamoveQuotationRequest): Promise<LalamoveQuotationResponse> {
    return this.makeRequest('POST', `/v3/quotations`, data);
  }

  /**
   * Get quotation details
   */
  async getQuotation(quotationId: string): Promise<LalamoveQuotationResponse> {
    return this.makeRequest('GET', `/v3/quotations/${quotationId}`);
  }

  /**
   * Create order from quotation
   */
  async createOrder(data: LalamoveOrderRequest): Promise<LalamoveOrderResponse> {
    return this.makeRequest('POST', `/v3/orders`, data);
  }

  /**
   * Get order details
   */
  async getOrder(orderId: string): Promise<LalamoveOrderResponse> {
    return this.makeRequest('GET', `/v3/orders/${orderId}`);
  }

  /**
   * Get driver information
   */
  async getDriver(orderId: string, driverId: string): Promise<LalamoveDriverResponse> {
    return this.makeRequest('GET', `/v3/orders/${orderId}/drivers/${driverId}`);
  }

  /**
   * Add priority fee to order
   */
  async addPriorityFee(
    orderId: string,
    data: LalalovePriorityFeeRequest,
  ): Promise<LalalovePriorityFeeResponse> {
    return this.makeRequest('PATCH', `/v3/orders/${orderId}/priority-fee`, data);
  }

  /**
   * Cancel order
   */
  async cancelOrder(orderId: string): Promise<LalamoveOrderResponse> {
    return this.makeRequest('DELETE', `/v3/orders/${orderId}`);
  }

  /**
   * Setup webhook URL
   */
  async setupWebhook(data: WebhookSetupRequest): Promise<WebhookSetupResponse> {
    return this.makeRequest('POST', `/v3/webhooks`, data);
  }

  /**
   * Verify webhook signature
   */
  verifyWebhookSignature(signature: string, timestamp: string, body: string): boolean {
    try {
      const expectedSignature = crypto
        .createHmac('sha256', this.apiSecret)
        .update(`${timestamp}${body}`)
        .digest('hex');

      const isValid = signature === expectedSignature;
      
      if (!isValid) {
        this.logger.warn('Invalid webhook signature');
      }

      return isValid;
    } catch (error) {
      this.logger.error(`Webhook signature verification error: ${error.message}`);
      return false;
    }
  }
}
