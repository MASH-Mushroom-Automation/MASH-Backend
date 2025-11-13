import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Req,
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
import { CartService } from './cart.service';
import { AddToCartDto } from './dto/add-to-cart.dto';
import { UpdateCartItemDto } from './dto/update-cart-item.dto';
import {
  CartResponseDto,
  CartSummaryResponseDto,
} from './dto/cart-response.dto';
import { EstimateShippingDto, CreateOrderFromCartDto } from './dto/cart-checkout.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Public } from '../auth/decorators/public.decorator';
import { PrismaService } from '../../database/prisma.service';
import { Request } from 'express';

@ApiTags('Cart')
@Controller('api/v1/cart')
export class CartController {
  private readonly logger = new Logger(CartController.name);

  constructor(
    private readonly cartService: CartService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Get current user's cart
   * Supports both authenticated users (via JWT) and guest users (via session)
   */
  @Get()
  @Public()
  @ApiOperation({
    summary: 'Get current cart',
    description:
      'Retrieve the active cart for authenticated user or guest session',
  })
  @ApiResponse({
    status: 200,
    description: 'Cart retrieved successfully',
    type: CartResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Cart not found' })
  async getCart(@Req() req: Request): Promise<CartResponseDto> {
    const userId = req.user?.['id'];
    const sessionId = req.cookies?.['cart_session_id'] || req.headers['x-session-id'];

    this.logger.log(
      `Getting cart for ${userId ? `user: ${userId}` : `session: ${sessionId}`}`,
    );

    return this.cartService.getOrCreateCart(userId, sessionId as string);
  }

  /**
   * Get cart summary (lightweight version)
   */
  @Get('summary')
  @Public()
  @ApiOperation({
    summary: 'Get cart summary',
    description: 'Get lightweight cart summary with item count and total',
  })
  @ApiResponse({
    status: 200,
    description: 'Cart summary retrieved successfully',
    type: CartSummaryResponseDto,
  })
  async getCartSummary(@Req() req: Request): Promise<CartSummaryResponseDto> {
    const userId = req.user?.['id'];
    const sessionId = req.cookies?.['cart_session_id'] || req.headers['x-session-id'];

    return this.cartService.getCartSummary(userId, sessionId as string);
  }

  /**
   * Add item to cart
   */
  @Post('items')
  @Public()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Add item to cart',
    description: 'Add a product to the cart with specified quantity',
  })
  @ApiResponse({
    status: 201,
    description: 'Item added to cart successfully',
    type: CartResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid product or quantity' })
  @ApiResponse({ status: 404, description: 'Product not found' })
  @ApiResponse({ status: 409, description: 'Insufficient stock' })
  async addItem(
    @Body() dto: AddToCartDto,
    @Req() req: Request,
  ): Promise<CartResponseDto> {
    const userId = req.user?.['id'];
    const sessionId = req.cookies?.['cart_session_id'] || req.headers['x-session-id'];

    this.logger.log(
      `Adding item ${dto.productId} (qty: ${dto.quantity}) to cart for ${userId ? `user: ${userId}` : `session: ${sessionId}`}`,
    );

    return this.cartService.addItem(userId, sessionId as string, dto);
  }

  /**
   * Update cart item quantity or customization
   */
  @Put('items/:itemId')
  @Public()
  @ApiOperation({
    summary: 'Update cart item',
    description: 'Update quantity or customization of an existing cart item',
  })
  @ApiParam({
    name: 'itemId',
    description: 'Cart item ID',
    example: 'clxxx123456789',
  })
  @ApiResponse({
    status: 200,
    description: 'Cart item updated successfully',
    type: CartResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid quantity' })
  @ApiResponse({ status: 404, description: 'Cart item not found' })
  @ApiResponse({ status: 409, description: 'Insufficient stock' })
  async updateItem(
    @Param('itemId') itemId: string,
    @Body() dto: UpdateCartItemDto,
    @Req() req: Request,
  ): Promise<CartResponseDto> {
    const userId = req.user?.['id'];
    const sessionId = req.cookies?.['cart_session_id'] || req.headers['x-session-id'];

    this.logger.log(
      `Updating cart item ${itemId} for ${userId ? `user: ${userId}` : `session: ${sessionId}`}`,
    );

    // Get cart first to verify ownership
    const cart = await this.cartService.getOrCreateCart(
      userId,
      sessionId as string,
    );

    return this.cartService.updateItem(cart.id, itemId, dto);
  }

  /**
   * Remove item from cart
   */
  @Delete('items/:itemId')
  @Public()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Remove item from cart',
    description: 'Delete a specific item from the cart',
  })
  @ApiParam({
    name: 'itemId',
    description: 'Cart item ID to remove',
    example: 'clxxx123456789',
  })
  @ApiResponse({ status: 204, description: 'Item removed successfully' })
  @ApiResponse({ status: 404, description: 'Cart item not found' })
  async removeItem(
    @Param('itemId') itemId: string,
    @Req() req: Request,
  ): Promise<void> {
    const userId = req.user?.['id'];
    const sessionId = req.cookies?.['cart_session_id'] || req.headers['x-session-id'];

    this.logger.log(
      `Removing cart item ${itemId} for ${userId ? `user: ${userId}` : `session: ${sessionId}`}`,
    );

    // Get cart first to verify ownership
    const cart = await this.cartService.getOrCreateCart(
      userId,
      sessionId as string,
    );

    await this.cartService.removeItem(cart.id, itemId);
  }

  /**
   * Clear entire cart
   */
  @Delete()
  @Public()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Clear cart',
    description: 'Remove all items from the cart',
  })
  @ApiResponse({ status: 204, description: 'Cart cleared successfully' })
  @ApiResponse({ status: 404, description: 'Cart not found' })
  async clearCart(@Req() req: Request): Promise<void> {
    const userId = req.user?.['id'];
    const sessionId = req.cookies?.['cart_session_id'] || req.headers['x-session-id'];

    this.logger.log(
      `Clearing cart for ${userId ? `user: ${userId}` : `session: ${sessionId}`}`,
    );

    const cart = await this.cartService.getOrCreateCart(
      userId,
      sessionId as string,
    );

    await this.cartService.clearCart(cart.id);
  }

  /**
   * Validate cart (check stock availability and price changes)
   */
  @Post('validate')
  @Public()
  @ApiOperation({
    summary: 'Validate cart',
    description:
      'Check cart for stock availability and price changes before checkout',
  })
  @ApiResponse({
    status: 200,
    description: 'Cart validation results',
    schema: {
      type: 'object',
      properties: {
        valid: { type: 'boolean' },
        items: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              itemId: { type: 'string' },
              productId: { type: 'string' },
              isAvailable: { type: 'boolean' },
              currentStock: { type: 'number' },
              requestedQuantity: { type: 'number' },
              priceChanged: { type: 'boolean' },
              oldPrice: { type: 'number' },
              newPrice: { type: 'number' },
            },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Cart not found' })
  async validateCart(@Req() req: Request) {
    const userId = req.user?.['id'];
    const sessionId = req.cookies?.['cart_session_id'] || req.headers['x-session-id'];

    this.logger.log(
      `Validating cart for ${userId ? `user: ${userId}` : `session: ${sessionId}`}`,
    );

    const cart = await this.cartService.getOrCreateCart(
      userId,
      sessionId as string,
    );

    return this.cartService.validateCart(cart.id);
  }

  /**
   * Merge guest cart into user cart (called after login)
   */
  @Post('merge')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Merge guest cart into user cart',
    description:
      'Merge items from guest cart (identified by session ID) into authenticated user cart. Called automatically after login.',
  })
  @ApiResponse({
    status: 200,
    description: 'Guest cart merged successfully',
    type: CartResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized - JWT required' })
  async mergeGuestCart(@Req() req: Request): Promise<CartResponseDto> {
    const userId = req.user?.['id'];
    const guestSessionId =
      req.cookies?.['cart_session_id'] || (req.headers['x-session-id'] as string);

    if (!userId) {
      throw new Error('User ID not found in request');
    }

    if (!guestSessionId) {
      this.logger.log('No guest session ID found, returning user cart');
      return this.cartService.getOrCreateCart(userId);
    }

    this.logger.log(
      `Merging guest cart (session: ${guestSessionId}) for user: ${userId}`,
    );

    return this.cartService.mergeGuestCart(userId, guestSessionId);
  }

  /**
   * Estimate shipping for cart (Phase 6)
   */
  @Post('shipping/estimate')
  @Public()
  @ApiOperation({
    summary: 'Estimate shipping cost',
    description:
      'Calculate shipping options and costs based on cart weight and destination address',
  })
  @ApiResponse({
    status: 200,
    description: 'Shipping estimate calculated',
    schema: {
      type: 'object',
      properties: {
        selectedMethod: { type: 'string', example: 'STANDARD' },
        cost: { type: 'number', example: 150.00 },
        estimatedDays: { type: 'number', example: 5 },
        availableOptions: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              method: { type: 'string' },
              cost: { type: 'number' },
              estimatedDays: { type: 'number' },
              description: { type: 'string' },
            },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Cart not found' })
  async estimateShipping(
    @Req() req: Request,
    @Body() dto: EstimateShippingDto,
  ) {
    const userId = req.user?.['id'];
    const sessionId =
      req.cookies?.['cart_session_id'] || (req.headers['x-session-id'] as string);

    const cart = await this.cartService.getOrCreateCart(userId, sessionId);

    return this.cartService.estimateShipping(cart.id, dto.address);
  }

  /**
   * Checkout: Create order from cart (Phase 6)
   */
  @Post('checkout')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Checkout cart and create order',
    description:
      'Convert cart to order, validate stock, deduct inventory, and create payment record. Cart will be marked as COMPLETED.',
  })
  @ApiResponse({
    status: 201,
    description: 'Order created successfully from cart',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        orderNumber: { type: 'string' },
        status: { type: 'string' },
        total: { type: 'number' },
        items: { type: 'array' },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Cart is empty or invalid' })
  @ApiResponse({ status: 401, description: 'Unauthorized - JWT required' })
  @ApiResponse({ status: 404, description: 'Cart not found' })
  @ApiResponse({ status: 409, description: 'Insufficient stock' })
  async checkout(
    @Req() req: Request,
    @Body() dto: CreateOrderFromCartDto,
  ) {
    const userId = req.user?.['id'];

    if (!userId) {
      throw new Error('User ID not found in request');
    }

    // Get user's cart
    const cart = await this.cartService.getOrCreateCart(userId);

    // Update cart with shipping/tax before checkout
    await this.cartService.calculateTotals(
      cart.id,
      dto.shippingAddress,
      dto.shippingMethod || 'STANDARD',
    );

    // Store addresses in cart metadata for order creation
    await this.prisma.cart.update({
      where: { id: cart.id },
      data: {
        metadata: {
          shippingAddress: dto.shippingAddress as any,
          billingAddress: (dto.billingAddress || dto.shippingAddress) as any,
          notes: dto.notes,
        } as any,
      },
    });

    // Create order from cart (this will be handled by OrdersService)
    // For now, we'll need to inject OrdersService
    this.logger.log(
      `Checkout initiated for cart ${cart.id} by user ${userId}`,
    );

    return {
      message: 'Checkout endpoint ready. OrdersService integration pending.',
      cartId: cart.id,
      userId,
      paymentMethod: dto.paymentMethod,
    };
  }
}

