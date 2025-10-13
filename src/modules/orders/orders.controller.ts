import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { OrderQueryDto } from './dto/order-query.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { CancelOrderDto } from './dto/cancel-order.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { SelectableFields } from '../../common/decorators/selectable-fields.decorator';
import { ThrottleEndpoint } from '../../common/decorators/throttle-endpoint.decorator';

@ApiTags('orders')
@Controller('orders')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
@ThrottleEndpoint('STANDARD') // Standard CRUD operations - 100 req/min
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  // 1. GET /api/v1/orders - List all orders with filtering
  @Get()
  @Roles('ADMIN', 'SUPER_ADMIN')
  @UseGuards(RolesGuard)
  @SelectableFields({
    allowedFields: [
      'id',
      'orderNumber',
      'status',
      'total',
      'userId',
      'shippingAddress',
      'createdAt',
      'updatedAt',
    ],
    requiredFields: ['id', 'orderNumber', 'status'],
    defaultFields: ['id', 'orderNumber', 'status', 'total', 'createdAt'],
    maxFields: 12,
  })
  @ApiOperation({ summary: 'List all orders with pagination and filters' })
  @ApiResponse({ status: 200, description: 'Orders retrieved successfully' })
  async findAll(@Query() query: OrderQueryDto) {
    return this.ordersService.findAll(query);
  }

  // 2. POST /api/v1/orders - Create new order
  @Post()
  @ApiOperation({ summary: 'Create new order' })
  @ApiResponse({ status: 201, description: 'Order created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid order data' })
  async create(@Body() createOrderDto: CreateOrderDto, @Request() req) {
    return this.ordersService.create(createOrderDto, req.user);
  }

  // 3. GET /api/v1/orders/user/:userId - Get user's orders
  @Get('user/:userId')
  @ApiOperation({ summary: "Get user's order history" })
  @ApiResponse({
    status: 200,
    description: 'User orders retrieved successfully',
  })
  async getUserOrders(
    @Param('userId') userId: string,
    @Query() query: OrderQueryDto,
    @Request() req,
  ) {
    return this.ordersService.getUserOrders(userId, query, req.user);
  }

  // 4. GET /api/v1/orders/:id - Get order details
  @Get(':id')
  @SelectableFields({
    allowedFields: [
      'id',
      'orderNumber',
      'status',
      'total',
      'subtotal',
      'tax',
      'shipping',
      'userId',
      'shippingAddress',
      'billingAddress',
      'paymentMethod',
      'createdAt',
      'updatedAt',
    ],
    requiredFields: ['id', 'orderNumber'],
    defaultFields: [
      'id',
      'orderNumber',
      'status',
      'total',
      'shippingAddress',
      'createdAt',
    ],
    maxFields: 15,
  })
  @ApiOperation({ summary: 'Get order by ID' })
  @ApiResponse({ status: 200, description: 'Order retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  async findOne(@Param('id') id: string, @Request() req) {
    return this.ordersService.findOne(id, req.user);
  }

  // 5. PUT /api/v1/orders/:id - Update order
  @Put(':id')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: 'Update order information' })
  @ApiResponse({ status: 200, description: 'Order updated successfully' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  async update(
    @Param('id') id: string,
    @Body() updateOrderDto: UpdateOrderDto,
  ) {
    return this.ordersService.update(id, updateOrderDto);
  }

  // 6. DELETE /api/v1/orders/:id - Delete order (admin only)
  @Delete(':id')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: 'Delete order (soft delete)' })
  @ApiResponse({ status: 200, description: 'Order deleted successfully' })
  async remove(@Param('id') id: string) {
    return this.ordersService.remove(id);
  }

  // 7. PUT /api/v1/orders/:id/status - Update order status
  @Put(':id/status')
  @Roles('ADMIN', 'SUPER_ADMIN', 'GROWER')
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: 'Update order status' })
  @ApiResponse({
    status: 200,
    description: 'Order status updated successfully',
  })
  async updateStatus(
    @Param('id') id: string,
    @Body() updateStatusDto: UpdateOrderStatusDto,
  ) {
    return this.ordersService.updateStatus(id, updateStatusDto);
  }

  // 8. POST /api/v1/orders/:id/cancel - Cancel order
  @Post(':id/cancel')
  @ApiOperation({ summary: 'Cancel order' })
  @ApiResponse({ status: 200, description: 'Order cancelled successfully' })
  @ApiResponse({ status: 400, description: 'Order cannot be cancelled' })
  async cancel(
    @Param('id') id: string,
    @Body() cancelOrderDto: CancelOrderDto,
    @Request() req,
  ) {
    return this.ordersService.cancel(id, cancelOrderDto, req.user);
  }

  // 9. GET /api/v1/orders/:id/items - Get order items
  @Get(':id/items')
  @ApiOperation({ summary: 'Get order items' })
  @ApiResponse({
    status: 200,
    description: 'Order items retrieved successfully',
  })
  async getOrderItems(@Param('id') id: string, @Request() req) {
    return this.ordersService.getOrderItems(id, req.user);
  }

  // 10. GET /api/v1/orders/:id/tracking - Get order tracking info
  @Get(':id/tracking')
  @ApiOperation({ summary: 'Get order tracking information' })
  @ApiResponse({
    status: 200,
    description: 'Tracking info retrieved successfully',
  })
  async getTracking(@Param('id') id: string, @Request() req) {
    return this.ordersService.getTracking(id, req.user);
  }

  // 11. GET /api/v1/orders/:id/invoice - Get order invoice
  @Get(':id/invoice')
  @ApiOperation({ summary: 'Get order invoice' })
  @ApiResponse({ status: 200, description: 'Invoice retrieved successfully' })
  async getInvoice(@Param('id') id: string, @Request() req) {
    return this.ordersService.getInvoice(id, req.user);
  }

  // 12. GET /api/v1/orders/stats/summary - Get order statistics (admin)
  @Get('stats/summary')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: 'Get order statistics and analytics' })
  @ApiResponse({
    status: 200,
    description: 'Statistics retrieved successfully',
  })
  async getStatistics(@Query() query: OrderQueryDto) {
    return this.ordersService.getStatistics(query);
  }

  // 13. POST /api/v1/orders/:id/payment - Process order payment
  @Post(':id/payment')
  @ApiOperation({ summary: 'Process order payment' })
  @ApiResponse({ status: 200, description: 'Payment processed successfully' })
  @ApiResponse({ status: 400, description: 'Payment processing failed' })
  async processPayment(@Param('id') id: string, @Request() req) {
    return this.ordersService.processPayment(id, req.user);
  }

  // 14. PUT /api/v1/orders/:id/shipping - Update shipping information
  @Put(':id/shipping')
  @Roles('ADMIN', 'SUPER_ADMIN', 'GROWER')
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: 'Update shipping information' })
  @ApiResponse({
    status: 200,
    description: 'Shipping info updated successfully',
  })
  async updateShipping(@Param('id') id: string, @Body() shippingData: any) {
    return this.ordersService.updateShipping(id, shippingData);
  }
}
