import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { LalamoveApiService } from './services/lalamove-api.service';
import { CreateQuotationDto } from './dto/create-quotation.dto';
import { CreateOrderDto } from './dto/create-order.dto';
import { QuotationResponseDto } from './dto/quotation-response.dto';
import { OrderResponseDto } from './dto/order-response.dto';
import { DriverResponseDto } from './dto/driver-response.dto';
import { QUOTATION_EXPIRY_MINUTES } from './constants/lalamove.constants';

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
      language: dto.language || 'en_PH',
      stops: dto.stops.map((stop) => ({
        coordinates: stop.coordinates,
        address: stop.address,
      })),
      items: dto.items,
      isScheduled: dto.isScheduled,
      scheduleAt: dto.scheduleAt,
      specialRequests: dto.specialRequests,
    });

    // Save to database
    await this.prisma.lalamoveQuotation.create({
      data: {
        quotationId: response.quotationId,
        serviceType: response.serviceType,
        totalPrice: parseFloat(response.priceBreakdown.total),
        currency: response.priceBreakdown.currency,
        distance: parseFloat(response.distance.value),
        distanceUnit: response.distance.unit,
        stops: response.stops as any,
        isScheduled: dto.isScheduled || false,
        scheduleAt: dto.scheduleAt ? new Date(dto.scheduleAt) : null,
        expiresAt: new Date(response.expiresAt),
        status: 'ACTIVE',
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
        data: { status: 'EXPIRED' },
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

    if (quotation.status === 'EXPIRED' || new Date() > quotation.expiresAt) {
      throw new BadRequestException('Quotation has expired. Please create a new quotation.');
    }

    if (quotation.status === 'USED') {
      throw new BadRequestException('Quotation has already been used');
    }

    // Create order via Lalamove API
    const response = await this.lalamoveApi.createOrder({
      quotationId: dto.quotationId,
      sender: {
        stopId: dto.sender.stopId,
        name: dto.sender.name,
        phone: dto.sender.phone,
        remarks: dto.sender.remarks,
      },
      recipients: dto.recipients.map(r => ({
        stopId: r.stopId,
        name: r.name,
        phone: r.phone,
        remarks: r.remarks,
      })),
      isPODEnabled: dto.isPODEnabled,
      orderReference: dto.orderReference,
      specialRequests: dto.specialRequests,
    });

    // Save order to database
    await this.prisma.lalamoveOrder.create({
      data: {
        orderId: response.orderId,
        quotationId: dto.quotationId,
        status: response.status,
        driverId: response.driverId,
        shareLink: response.shareLink,
        totalPrice: parseFloat(response.priceBreakdown.total),
        currency: response.priceBreakdown.currency,
        distance: parseFloat(response.distance.value),
        distanceUnit: response.distance.unit,
        stops: response.stops as any,
        isPODEnabled: dto.isPODEnabled ?? true,
        orderReference: dto.orderReference,
      },
    });

    // Mark quotation as used
    await this.prisma.lalamoveQuotation.update({
      where: { quotationId: dto.quotationId },
      data: { status: 'USED' },
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
    
    return response as DriverResponseDto;
  }

  /**
   * Add priority fee to order
   */
  async addPriorityFee(orderId: string, dto: AddPriorityFeeDto): Promise<any> {
    const response = await this.lalamoveApi.addPriorityFee(orderId, { amount: dto.amount });
    
    // Update database
    await this.prisma.lalamoveOrder.update({
      where: { orderId },
      data: {
        totalPrice: parseFloat(response.priceBreakdown.total),
      },
    });

    return response;
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
        updatedAt: new Date(),
      },
    });

    this.logger.log(`✅ Order cancelled: ${orderId}`);
  }

  /**
   * Setup webhook
   */
  async setupWebhook(webhookUrl: string): Promise<any> {
    return this.lalamoveApi.setupWebhook({ url: webhookUrl });
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
