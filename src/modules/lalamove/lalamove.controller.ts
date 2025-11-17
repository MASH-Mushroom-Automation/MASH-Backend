import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { LalamoveService } from './lalamove.service';
import { WebhookService } from './services/webhook.service';
import { WebhookSignatureGuard } from './guards/webhook-signature.guard';
import { CreateQuotationDto } from './dto/create-quotation.dto';
import { CreateOrderDto } from './dto/create-order.dto';
import { QuotationResponseDto } from './dto/quotation-response.dto';
import { OrderResponseDto } from './dto/order-response.dto';
import { DriverResponseDto } from './dto/driver-response.dto';
import { WebhookEventDto, SetupWebhookDto } from './dto/webhook-event.dto';
import { AddPriorityFeeDto } from './dto/add-priority-fee.dto';

/**
 * LalamoveController
 * Handles all Lalamove delivery integration endpoints
 * 
 * @swagger
 * - All endpoints require JWT authentication except webhook
 * - Admin endpoints require ADMIN or SUPER_ADMIN role
 * - Webhook endpoint requires valid Lalamove signature
 */
@ApiTags('lalamove')
@Controller('api/v1/lalamove')
@UseGuards(JwtAuthGuard, RolesGuard)
export class LalamoveController {
  private readonly logger = new Logger(LalamoveController.name);

  constructor(
    private readonly lalamoveService: LalamoveService,
    private readonly webhookService: WebhookService,
  ) {}

  // ==================== CITY INFO ====================

  @Get('city-info')
  @ApiOperation({ 
    summary: 'Get city information',
    description: 'Retrieve available cities, service types, and special requests for Philippines market'
  })
  @ApiResponse({ status: 200, description: 'City information retrieved successfully' })
  @ApiBearerAuth()
  async getCityInfo() {
    return this.lalamoveService.getCityInfo();
  }

  // ==================== QUOTATIONS ====================

  @Post('quotations')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ 
    summary: 'Create quotation',
    description: 'Create a delivery quotation (immediate or scheduled). Quotations expire in 5 minutes.'
  })
  @ApiResponse({ status: 201, description: 'Quotation created successfully', type: QuotationResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid request data' })
  @ApiBearerAuth()
  async createQuotation(@Body() createQuotationDto: CreateQuotationDto): Promise<QuotationResponseDto> {
    return this.lalamoveService.createQuotation(createQuotationDto);
  }

  @Get('quotations/:quotationId')
  @ApiOperation({ summary: 'Get quotation details' })
  @ApiParam({ name: 'quotationId', description: 'Lalamove quotation ID' })
  @ApiResponse({ status: 200, description: 'Quotation details retrieved', type: QuotationResponseDto })
  @ApiBearerAuth()
  async getQuotation(@Param('quotationId') quotationId: string): Promise<QuotationResponseDto> {
    return this.lalamoveService.getQuotation(quotationId);
  }

  // ==================== ORDERS ====================

  @Post('orders')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ 
    summary: 'Create delivery order',
    description: 'Create order from quotation. Quotation must be valid (not expired).'
  })
  @ApiResponse({ status: 201, description: 'Order created successfully', type: OrderResponseDto })
  @ApiBearerAuth()
  async createOrder(@Body() createOrderDto: CreateOrderDto): Promise<OrderResponseDto> {
    return this.lalamoveService.createOrder(createOrderDto);
  }

  @Get('orders/:orderId')
  @ApiOperation({ summary: 'Get order details and status' })
  @ApiParam({ name: 'orderId', description: 'Lalamove order ID' })
  @ApiResponse({ status: 200, description: 'Order details retrieved', type: OrderResponseDto })
  @ApiBearerAuth()
  async getOrder(@Param('orderId') orderId: string): Promise<OrderResponseDto> {
    return this.lalamoveService.getOrder(orderId);
  }

  @Delete('orders/:orderId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Cancel order' })
  @ApiParam({ name: 'orderId', description: 'Lalamove order ID' })
  @ApiResponse({ status: 204, description: 'Order cancelled successfully' })
  @ApiBearerAuth()
  async cancelOrder(@Param('orderId') orderId: string): Promise<void> {
    return this.lalamoveService.cancelOrder(orderId);
  }

  // ==================== DRIVER INFO ====================

  @Get('orders/:orderId/drivers/:driverId')
  @ApiOperation({ summary: 'Get driver details and location' })
  @ApiParam({ name: 'orderId', description: 'Lalamove order ID' })
  @ApiParam({ name: 'driverId', description: 'Driver ID' })
  @ApiResponse({ status: 200, description: 'Driver details retrieved', type: DriverResponseDto })
  @ApiBearerAuth()
  async getDriver(
    @Param('orderId') orderId: string,
    @Param('driverId') driverId: string,
  ): Promise<DriverResponseDto> {
    return this.lalamoveService.getDriver(orderId);
  }

  // ==================== PRIORITY FEE ====================

  @Post('orders/:orderId/priority-fee')
  @ApiOperation({ summary: 'Add priority fee (tip)' })
  @ApiParam({ name: 'orderId', description: 'Lalamove order ID' })
  @ApiResponse({ status: 200, description: 'Priority fee added', type: OrderResponseDto })
  @ApiBearerAuth()
  async addPriorityFee(
    @Param('orderId') orderId: string,
    @Body() dto: AddPriorityFeeDto,
  ): Promise<OrderResponseDto> {
    return this.lalamoveService.addPriorityFee(orderId, dto);
  }

  // ==================== WEBHOOKS ====================

  @Post('webhook')
  @Public()
  @UseGuards(WebhookSignatureGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Webhook endpoint for Lalamove events' })
  @ApiResponse({ status: 200, description: 'Webhook processed successfully' })
  async handleWebhook(@Body() webhookEvent: WebhookEventDto): Promise<{ success: boolean }> {
    await this.webhookService.processWebhookEvent(webhookEvent as any);
    await this.webhookService.logWebhookEvent(webhookEvent as any, 'SUCCESS');
    return { success: true };
  }

  @Post('webhook/setup')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Setup webhook URL' })
  @ApiResponse({ status: 200, description: 'Webhook configured' })
  @ApiBearerAuth()
  async setupWebhook(@Body() dto: SetupWebhookDto) {
    return this.lalamoveService.setupWebhook(dto.webhookUrl);
  }
}
