import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { LalamoveApiService } from './lalamove-api.service';
import { CreateQuotationDto } from '../dto/create-quotation.dto';
import { CreateOrderDto } from '../dto/create-order.dto';
import { QuotationResponseDto } from '../dto/quotation-response.dto';
import { OrderResponseDto } from '../dto/order-response.dto';
import { DriverResponseDto } from '../dto/driver-response.dto';
import { QUOTATION_EXPIRY_MINUTES } from '../constants/lalamove.constants';

/**
 * LalamoveService
 * Main business logic service for Lalamove integration
 * Coordinates between Lalamove API and local database
 */
@Injectable()
export class LalamoveService {
  private readonly logger = new Logger(LalamoveService.name);

  constructor(
    private readonly lalamoveApi: LalamoveApiService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Get city information for Philippines market
   */
  async getCityInfo(): Promise<any> {
    return this.lalamoveApi.getCityInfo();
  }

  /**
   * Create quotation and save to database
   */
  async createQuotation(dto: CreateQuotationDto): Promise<QuotationResponseDto> {
    this.logger.log(`Creating quotation for ${dto.serviceType}`);

    // Validate scheduled time if provided
    if (dto.scheduleAt) {
      this.validateScheduledTime(dto.scheduleAt);
    }

    // Call Lalamove API
    const response = await this.lalamoveApi.createQuotation({
      serviceType: dto.serviceType,
      language: 'en_PH',
      stops: dto.stops.map((stop) => ({
        coordinates: stop.coordinates,
        address: stop.address,
      })),
      item: dto.item,
      scheduleAt: dto.scheduleAt,
    });

    // Save to database
    await this.prisma.lalamoveQuotation.create({
      data: {
        quotationId: response.quotationId,
        orderId: dto.orderId,
        serviceType: response.serviceType,
        language: 'en_PH',
        totalPrice: parseFloat(response.priceBreakdown.total),
        currency: response.priceBreakdown.currency,
        priceBreakdown: response.priceBreakdown as any,
        distance: parseFloat(response.distance.value),
        distanceUnit: response.distance.unit,
        stops: response.stops as any,
        scheduleAt: dto.scheduleAt ? new Date(dto.scheduleAt) : null,
        expiresAt: new Date(response.expiresAt),
        metadata: dto.orderId ? { orderId: dto.orderId } : null,
      },
    });

    this.logger.log(`✅ Quotation created: ${response.quotationId}`);
    return response as QuotationResponseDto;
  }

  /**
   * Get quotation details
   */
  async getQuotation(quotationId: string): Promise<QuotationResponseDto> {
    // Check database first
    const dbQuotation = await this.prisma.lalamoveQuotation.findUnique({
      where: { quotationId },
    });

    if (!dbQuotation) {
      throw new NotFoundException(`Quotation ${quotationId} not found`);
    }

    // Check if expired
    if (new Date() > dbQuotation.expiresAt) {
      await this.prisma.lalamoveQuotation.update({
        where: { quotationId },
        data: { isExpired: true },
      });
      throw new BadRequestException('Quotation has expired');
    }

    // Fetch fresh data from Lalamove
    return this.lalamoveApi.getQuotation(quotationId) as Promise<QuotationResponseDto>;
  }

  /**
   * Create order from quotation
   */
  async createOrder(dto: CreateOrderDto): Promise<OrderResponseDto> {
    this.logger.log(`Creating order from quotation: ${dto.quotationId}`);

    // Validate quotation exists and not expired
    const quotation = await this.prisma.lalamoveQuotation.findUnique({
      where: { quotationId: dto.quotationId },
    });

    if (!quotation) {
      throw new NotFoundException(`Quotation ${dto.quotationId} not found`);
    }

    if (quotation.isExpired || new Date() > quotation.expiresAt) {
      throw new BadRequestException('Quotation has expired. Please create a new quotation.');
    }

    if (quotation.isUsed) {
      throw new BadRequestException('Quotation has already been used');
    }

    // Validate MASH order exists
    const mashOrder = await this.prisma.order.findUnique({
      where: { id: dto.orderId },
      include: { user: true },
    });

    if (!mashOrder) {
      throw new NotFoundException(`Order ${dto.orderId} not found`);
    }

    // Create order via Lalamove API
    const response = await this.lalamoveApi.createOrder({
      quotationId: dto.quotationId,
      sender: dto.sender,
      recipients: dto.recipients,
      isPODEnabled: dto.isPODEnabled,
      partner: 'J5Pharmacy',
      metadata: {
        mashOrderId: dto.orderId,
        mashOrderNumber: mashOrder.orderNumber,
        ...dto.metadata,
      },
    });

    // Save order to database
    await this.prisma.lalamoveOrder.create({
      data: {
        orderId: response.orderId,
        mashOrderId: dto.orderId,
        quotationId: dto.quotationId,
        status: response.status as any,
        statusHistory: [
          {
            status: response.status,
            timestamp: new Date().toISOString(),
            data: { source: 'order_created' },
          },
        ],
        driverId: response.driverId,
        shareLink: response.shareLink,
        sender: dto.sender as any,
        recipients: dto.recipients as any,
        totalPrice: parseFloat(response.priceBreakdown.total),
        priceBreakdown: response.priceBreakdown as any,
        isPODEnabled: dto.isPODEnabled ?? true,
        scheduleAt: quotation.scheduleAt,
        metadata: dto.metadata as any,
      },
    });

    // Mark quotation as used
    await this.prisma.lalamoveQuotation.update({
      where: { quotationId: dto.quotationId },
      data: { isUsed: true },
    });

    this.logger.log(`✅ Order created: ${response.orderId}`);
    return response as OrderResponseDto;
  }

  /**
   * Get order details
   */
  async getOrder(orderId: string): Promise<OrderResponseDto> {
    const response = await this.lalamoveApi.getOrder(orderId);
    
    // Update database with latest status
    await this.updateOrderFromApi(orderId, response);
    
    return response as OrderResponseDto;
  }

  /**
   * Get driver details
   */
  async getDriver(orderId: string): Promise<DriverResponseDto> {
    // Get order to find driver ID
    const order = await this.prisma.lalamoveOrder.findUnique({
      where: { orderId },
    });

    if (!order) {
      throw new NotFoundException(`Order ${orderId} not found`);
    }

    if (!order.driverId) {
      throw new BadRequestException('Driver not yet assigned to this order');
    }

    const response = await this.lalamoveApi.getDriver(orderId, order.driverId);
    
    // Update driver info in database
    await this.prisma.lalamoveOrder.update({
      where: { orderId },
      data: {
        driverName: response.name,
        driverPhone: response.phone,
        driverPhoto: response.photo,
        plateNumber: response.plateNumber,
        currentLocation: response.coordinates as any,
      },
    });

    return response as DriverResponseDto;
  }

  /**
   * Add priority fee to order
   */
  async addPriorityFee(orderId: string, priorityFee: string): Promise<OrderResponseDto> {
    const response = await this.lalamoveApi.addPriorityFee(orderId, priorityFee);
    
    // Update database
    await this.prisma.lalamoveOrder.update({
      where: { orderId },
      data: {
        priorityFee: parseFloat(priorityFee),
        priceBreakdown: response.priceBreakdown as any,
      },
    });

    return response as OrderResponseDto;
  }

  /**
   * Cancel order
   */
  async cancelOrder(orderId: string): Promise<void> {
    await this.lalamoveApi.cancelOrder(orderId);
    
    // Update database
    await this.prisma.lalamoveOrder.update({
      where: { orderId },
      data: {
        status: 'CANCELED',
        cancelledAt: new Date(),
        statusHistory: {
          push: {
            status: 'CANCELED',
            timestamp: new Date().toISOString(),
            data: { source: 'manual_cancellation' },
          },
        },
      },
    });

    this.logger.log(`✅ Order cancelled: ${orderId}`);
  }

  /**
   * Setup webhook
   */
  async setupWebhook(webhookUrl: string): Promise<any> {
    return this.lalamoveApi.setupWebhook(webhookUrl);
  }

  /**
   * Update order from API response
   */
  private async updateOrderFromApi(orderId: string, apiResponse: any): Promise<void> {
    const updateData: any = {
      status: apiResponse.status,
      driverId: apiResponse.driverId,
      shareLink: apiResponse.shareLink,
      priceBreakdown: apiResponse.priceBreakdown,
    };

    // Update timestamps based on status
    if (apiResponse.status === 'PICKED_UP' && !updateData.pickedUpAt) {
      updateData.pickedUpAt = new Date();
    }
    if (apiResponse.status === 'COMPLETED' && !updateData.deliveredAt) {
      updateData.deliveredAt = new Date();
    }

    await this.prisma.lalamoveOrder.update({
      where: { orderId },
      data: updateData,
    });
  }

  /**
   * Validate scheduled time (must be at least 2 hours from now)
   */
  private validateScheduledTime(scheduleAt: string): void {
    const now = new Date();
    const scheduled = new Date(scheduleAt);
    const twoHoursFromNow = new Date(now.getTime() + 2 * 60 * 60 * 1000);

    if (scheduled < twoHoursFromNow) {
      throw new BadRequestException('Scheduled time must be at least 2 hours from now');
    }
  }
}
