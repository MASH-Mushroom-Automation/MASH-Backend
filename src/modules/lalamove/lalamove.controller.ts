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
    description: 'Retrieve available cities, service types, and special_requests for Philippines market'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'City information retrieved successfully',
    schema: {
      example: {
        cities: [
          { locode: 'PH_MNL', name: 'Metro Manila' },
          { locode: 'PH_CEB', name: 'Cebu' }
        ],
        service_types: ['MOTORCYCLE', 'SEDAN', 'MPV', 'VAN'],
        special_requests: ['COD', 'FRAGILE']
      }
    }
  })
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
  @ApiResponse({ 
    status: 201, 
    description: 'Quotation created successfully',
    type: QuotationResponseDto 
  })
  @ApiResponse({ status: 400, description: 'Invalid request data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiBearerAuth()
  async createQuotation(
    @Body() createQuotationDto: CreateQuotationDto,
  ): Promise<QuotationResponseDto> {
    return this.lalamoveService.createQuotation(createQuotationDto);
  }

  @Get('quotations/:quotationId')
  @ApiOperation({ 
    summary: 'Get quotation details',
    description: 'Retrieve details of an existing quotation by ID'
  })
  @ApiParam({ name: 'quotationId', description: 'Lalamove quotation ID' })
  @ApiResponse({ 
    status: 200, 
    description: 'Quotation details retrieved successfully',
    type: QuotationResponseDto 
  })
  @ApiResponse({ status: 404, description: 'Quotation not found' })
  @ApiResponse({ status: 400, description: 'Quotation expired' })
  @ApiBearerAuth()
  async getQuotation(
    @Param('quotationId') quotationId: string,
  ): Promise<QuotationResponseDto> {
    return this.lalamoveService.getQuotation(quotationId);
  }

  // ==================== ORDERS ====================

  @Post('orders')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ 
    summary: 'Create order',
    description: 'Create a delivery order from an existing quotation. Assigns a driver and starts delivery.'
  })
  @ApiResponse({ 
    status: 201, 
    description: 'Order created successfully',
    type: OrderResponseDto 
  })
  @ApiResponse({ status: 400, description: 'Invalid request data or quotation expired' })
  @ApiResponse({ status: 404, description: 'Quotation or MASH order not found' })
  @ApiBearerAuth()
  async createOrder(
    @Body() createOrderDto: CreateOrderDto,
  ): Promise<OrderResponseDto> {
    return this.lalamoveService.createOrder(createOrderDto);
  }

  @Get('orders/:orderId')
  @ApiOperation({ 
    summary: 'Get order details',
    description: 'Retrieve current status and details of a delivery order'
  })
  @ApiParam({ name: 'orderId', description: 'Lalamove order ID' })
  @ApiResponse({ 
    status: 200, 
    description: 'Order details retrieved successfully',
    type: OrderResponseDto 
  })
  @ApiResponse({ status: 404, description: 'Order not found' })
  @ApiBearerAuth()
  async getOrder(
    @Param('orderId') orderId: string,
  ): Promise<OrderResponseDto> {
    return this.lalamoveService.getOrder(orderId);
  }

  // ==================== DRIVER ====================

  @Get('orders/:orderId/driver')
  @ApiOperation({ 
    summary: 'Get driver details',
    description: 'Retrieve assigned driver information and current location'
  })
  @ApiParam({ name: 'orderId', description: 'Lalamove order ID' })
  @ApiResponse({ 
    status: 200, 
    description: 'Driver details retrieved successfully',
    type: DriverResponseDto 
  })
  @ApiResponse({ status: 404, description: 'Order not found' })
  @ApiResponse({ status: 400, description: 'Driver not yet assigned' })
  @ApiBearerAuth()
  async getDriver(
    @Param('orderId') orderId: string,
  ): Promise<DriverResponseDto> {
    return this.lalamoveService.getDriver(orderId);
  }

  // ==================== PRIORITY FEE ====================

  @Post('orders/:orderId/priority-fee')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Add priority fee (tip)',
    description: 'Add a tip/priority fee to an existing order to prioritize delivery'
  })
  @ApiParam({ name: 'orderId', description: 'Lalamove order ID' })
  @ApiResponse({ 
    status: 200, 
    description: 'Priority fee added successfully',
    type: OrderResponseDto 
  })
  @ApiResponse({ status: 404, description: 'Order not found' })
  @ApiResponse({ status: 400, description: 'Invalid priority fee amount' })
  @ApiBearerAuth()
  async addPriorityFee(
    @Param('orderId') orderId: string,
    @Body() addPriorityFeeDto: AddPriorityFeeDto,
  ): Promise<OrderResponseDto> {
    return this.lalamoveService.addPriorityFee(orderId, addPriorityFeeDto.priorityFee);
  }

  // ==================== CANCEL ORDER ====================

  @Delete('orders/:orderId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ 
    summary: 'Cancel order',
    description: 'Cancel an existing delivery order. May incur cancellation fees.'
  })
  @ApiParam({ name: 'orderId', description: 'Lalamove order ID' })
  @ApiResponse({ status: 204, description: 'Order cancelled successfully' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  @ApiResponse({ status: 400, description: 'Order cannot be cancelled' })
  @ApiBearerAuth()
  async cancelOrder(@Param('orderId') orderId: string): Promise<void> {
    return this.lalamoveService.cancelOrder(orderId);
  }

  // ==================== WEBHOOK ====================

  @Post('webhook')
  @Public()
  @UseGuards(WebhookSignatureGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Receive webhook events',
    description: 'Endpoint for Lalamove to send delivery status updates. Requires valid HMAC signature.'
  })
  @ApiResponse({ status: 200, description: 'Webhook processed successfully' })
  @ApiResponse({ status: 401, description: 'Invalid webhook signature' })
  async handleWebhook(@Body() webhookEvent: WebhookEventDto): Promise<void> {
    this.logger.log(`📨 Webhook received: ${webhookEvent.eventType}`);
    await this.webhookService.handleWebhookEvent(webhookEvent);
  }

  // ==================== ADMIN: WEBHOOK SETUP ====================

  @Post('webhook/setup')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Setup webhook URL (Admin only)',
    description: 'Configure the webhook URL in Lalamove dashboard. Requires ADMIN role.'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Webhook URL configured successfully',
    schema: {
      example: {
        webhookUrl: 'https://api.mashbackend.com/api/v1/lalamove/webhook',
        status: 'active'
      }
    }
  })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin access required' })
  @ApiBearerAuth()
  async setupWebhook(@Body() setupWebhookDto: SetupWebhookDto) {
    return this.lalamoveService.setupWebhook(setupWebhookDto.webhookUrl);
  }
}
