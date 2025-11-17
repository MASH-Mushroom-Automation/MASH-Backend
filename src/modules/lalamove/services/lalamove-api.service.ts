import { Injectable, Logger, BadRequestException, UnauthorizedException, ForbiddenException, NotFoundException, ConflictException, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import * as crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { firstValueFrom } from 'rxjs';
import {
  IQuotationRequest,
  IQuotationResponse,
} from '../interfaces/lalamove-quotation.interface';
import {
  IOrderRequest,
  IOrderResponse,
  IDriverInfo,
} from '../interfaces/lalamove-order.interface';
import {
  IWebhookSetupRequest,
  IWebhookSetupResponse,
} from '../interfaces/lalamove-webhook.interface';
import { API_REQUEST_TIMEOUT_MS } from '../constants/lalamove.constants';

/**
 * LalamoveApiService
 * Core service for interacting with Lalamove API v3
 * Handles HMAC SHA-256 signature generation and all API calls
 */
@Injectable()
export class LalamoveApiService {
  private readonly logger = new Logger(LalamoveApiService.name);
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly secret: string;
  private readonly market = 'PH';

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
  ) {
    this.baseUrl = this.configService.get<string>('LALAMOVE_BASE_URL', 'https://rest.sandbox.lalamove.com');
    this.apiKey = this.configService.get<string>('LALAMOVE_API_KEY');
    this.secret = this.configService.get<string>('LALAMOVE_SECRET');

    if (!this.apiKey || !this.secret) {
      this.logger.warn('⚠️ Lalamove credentials not configured');
    } else {
      this.logger.log(`✅ Lalamove API initialized (${this.baseUrl})`);
    }
  }

  /**
   * Get available cities and services for PH market
   */
  async getCityInfo(): Promise<any> {
    this.logger.log('Fetching city info for PH market');
    return this.makeRequest('GET', '/v3/cities');
  }

  /**
   * Create delivery quotation (immediate or scheduled)
   */
  async createQuotation(request: IQuotationRequest): Promise<IQuotationResponse> {
    this.logger.log(`Creating ${request.scheduleAt ? 'scheduled' : 'immediate'} quotation for ${request.serviceType}`);
    
    const payload = {
      data: {
        serviceType: request.serviceType,
        language: request.language || 'en_PH',
        stops: request.stops,
        item: request.item,
        ...(request.scheduleAt && { scheduleAt: request.scheduleAt }),
      },
    };

    const response = await this.makeRequest('POST', '/v3/quotations', payload);
    return response.data;
  }

  /**
   * Get quotation details by ID
   */
  async getQuotation(quotationId: string): Promise<IQuotationResponse> {
    this.logger.log(`Fetching quotation: ${quotationId}`);
    const response = await this.makeRequest('GET', `/v3/quotations/${quotationId}`);
    return response.data;
  }

  /**
   * Create delivery order from quotation
   */
  async createOrder(request: IOrderRequest): Promise<IOrderResponse> {
    this.logger.log(`Creating order from quotation: ${request.quotationId}`);
    
    const payload = {
      data: {
        quotationId: request.quotationId,
        sender: request.sender,
        recipients: request.recipients,
        isPODEnabled: request.isPODEnabled ?? true,
        ...(request.partner && { partner: request.partner }),
        ...(request.metadata && { metadata: request.metadata }),
      },
    };

    const response = await this.makeRequest('POST', '/v3/orders', payload);
    return response.data;
  }

  /**
   * Get order details and status
   */
  async getOrder(orderId: string): Promise<IOrderResponse> {
    this.logger.log(`Fetching order: ${orderId}`);
    const response = await this.makeRequest('GET', `/v3/orders/${orderId}`);
    return response.data;
  }

  /**
   * Get driver details and real-time location
   */
  async getDriver(orderId: string, driverId: string): Promise<IDriverInfo> {
    this.logger.log(`Fetching driver ${driverId} for order ${orderId}`);
    const response = await this.makeRequest('GET', `/v3/orders/${orderId}/drivers/${driverId}`);
    return response.data;
  }

  /**
   * Add priority fee (tip) to order
   */
  async addPriorityFee(orderId: string, priorityFee: string): Promise<IOrderResponse> {
    this.logger.log(`Adding priority fee ${priorityFee} to order ${orderId}`);
    
    const payload = {
      data: { priorityFee },
    };

    const response = await this.makeRequest('POST', `/v3/orders/${orderId}/priority-fee`, payload);
    return response.data;
  }

  /**
   * Cancel order
   */
  async cancelOrder(orderId: string): Promise<void> {
    this.logger.log(`Cancelling order: ${orderId}`);
    await this.makeRequest('DELETE', `/v3/orders/${orderId}`);
  }

  /**
   * Setup webhook URL for receiving events
   */
  async setupWebhook(webhookUrl: string): Promise<IWebhookSetupResponse> {
    this.logger.log(`Setting up webhook: ${webhookUrl}`);
    
    const payload = {
      data: { url: webhookUrl },
    };

    const response = await this.makeRequest('PATCH', '/v3/webhook', payload);
    return response.data;
  }

  /**
   * Make authenticated request to Lalamove API
   */
  private async makeRequest(
    method: string,
    path: string,
    body?: any,
  ): Promise<any> {
    const timestamp = Date.now().toString();
    const bodyString = body ? JSON.stringify(body) : '';

    // Generate HMAC signature
    const signature = this.generateSignature(method, path, timestamp, bodyString);
    const authHeader = `hmac ${this.apiKey}:${timestamp}:${signature}`;

    const headers = {
      'Authorization': authHeader,
      'Market': this.market,
      'Content-Type': 'application/json',
      'Request-ID': uuidv4(),
    };

    this.logger.debug(`${method} ${path}`);
    this.logger.debug(`Request-ID: ${headers['Request-ID']}`);

    try {
      const response = await firstValueFrom(
        this.httpService.request({
          method,
          url: `${this.baseUrl}${path}`,
          headers,
          data: body,
          timeout: API_REQUEST_TIMEOUT_MS,
        }),
      );

      this.logger.debug(`Response: ${response.status}`);
      return response.data;
    } catch (error) {
      this.handleApiError(error);
    }
  }

  /**
   * Generate HMAC SHA-256 signature for authentication
   * Format: ${timestamp}\r\n${method}\r\n${path}\r\n\r\n${body}
   */
  private generateSignature(
    method: string,
    path: string,
    timestamp: string,
    body: string = '',
  ): string {
    // CRITICAL: Use exact format with \r\n as required by Lalamove API
    const rawSignature = `${timestamp}\r\n${method}\r\n${path}\r\n\r\n${body}`;

    const signature = crypto
      .createHmac('sha256', this.secret)
      .update(rawSignature)
      .digest('hex');

    this.logger.debug(`Signature generated for ${method} ${path}`);
    return signature;
  }

  /**
   * Handle API errors and throw appropriate NestJS exceptions
   */
  private handleApiError(error: any): never {
    const status = error.response?.status;
    const message = error.response?.data?.message || error.message;
    const details = error.response?.data?.errors || [];

    this.logger.error(`Lalamove API error: ${status} - ${message}`, JSON.stringify(details));

    switch (status) {
      case 400:
        throw new BadRequestException(`Lalamove: ${message}`, { cause: details });
      case 401:
        throw new UnauthorizedException('Lalamove: Invalid credentials or signature');
      case 403:
        throw new ForbiddenException(`Lalamove: ${message}`);
      case 404:
        throw new NotFoundException(`Lalamove: ${message}`);
      case 409:
        throw new ConflictException(`Lalamove: ${message}`);
      case 422:
        throw new BadRequestException(`Lalamove: ${message}`, { cause: details });
      case 429:
        throw new BadRequestException('Lalamove: Rate limit exceeded');
      default:
        throw new InternalServerErrorException(`Lalamove API error: ${message}`);
    }
  }

  /**
   * Check if API is configured
   */
  isConfigured(): boolean {
    return !!(this.apiKey && this.secret);
  }
}
