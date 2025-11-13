import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { Prisma, CartStatus } from '@prisma/client';
import { AddToCartDto } from './dto/add-to-cart.dto';
import { UpdateCartItemDto } from './dto/update-cart-item.dto';
import { CartResponseDto, CartSummaryResponseDto } from './dto/cart-response.dto';
import { CartCacheService } from './cart-cache.service';

@Injectable()
export class CartService {
  private readonly logger = new Logger(CartService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CartCacheService,
  ) {}

  /**
   * Get or create a cart for a user or guest session
   * @param userId - User ID (authenticated users)
   * @param sessionId - Session ID (guest users)
   * @returns Cart with items
   */
  async getOrCreateCart(
    userId?: string,
    sessionId?: string,
  ): Promise<CartResponseDto> {
    if (!userId && !sessionId) {
      throw new BadRequestException('Either userId or sessionId is required');
    }

    // Try cache first
    const cachedCart = await this.cache.getCart(userId, sessionId);
    if (cachedCart) {
      this.logger.debug('Cart retrieved from cache');
      return cachedCart;
    }

    // Cache miss - query database
    let cart = await this.prisma.cart.findFirst({
      where: {
        ...(userId ? { userId } : { sessionId }),
        status: CartStatus.ACTIVE,
      },
      include: {
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                slug: true,
                images: true,
                stock: true,
                price: true,
                isActive: true,
              },
            },
          },
        },
      },
    });

    // Create new cart if not found
    if (!cart) {
      cart = await this.prisma.cart.create({
        data: {
          userId,
          sessionId,
          status: CartStatus.ACTIVE,
          lastActivityAt: new Date(),
        },
        include: {
          items: {
            include: {
              product: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                  images: true,
                  stock: true,
                  price: true,
                  isActive: true,
                },
              },
            },
          },
        },
      });
    }

    const response = this.formatCartResponse(cart);

    // Warm cache with cart data
    await this.cache.setCart(response, userId, sessionId);

    return response;
  }

  /**
   * Add item to cart with stock validation and price locking
   * @param userId - User ID
   * @param sessionId - Session ID
   * @param dto - Add to cart data
   * @returns Updated cart
   */
  async addItem(
    userId: string | undefined,
    sessionId: string | undefined,
    dto: AddToCartDto,
  ): Promise<CartResponseDto> {
    // Get or create cart
    const cart = await this.getOrCreateCart(userId, sessionId);

    // Validate product
    const product = await this.prisma.product.findUnique({
      where: { id: dto.productId },
    });

    if (!product) {
      throw new NotFoundException(`Product with ID ${dto.productId} not found`);
    }

    if (!product.isActive) {
      throw new BadRequestException('Product is not available');
    }

    // Stock validation
    if (product.stock < dto.quantity) {
      throw new BadRequestException(
        `Insufficient stock. Available: ${product.stock}, Requested: ${dto.quantity}`,
      );
    }

    // Quantity limit validation
    const maxQty = product.maxCartQty || product.stock;
    if (dto.quantity > maxQty) {
      throw new BadRequestException(
        `Quantity exceeds maximum allowed (${maxQty})`,
      );
    }

    // Check if item already exists in cart
    const existingItem = await this.prisma.cartItem.findUnique({
      where: {
        cartId_productId: {
          cartId: cart.id,
          productId: dto.productId,
        },
      },
    });

    if (existingItem) {
      // Update existing item quantity
      const newQuantity = existingItem.quantity + dto.quantity;

      // Validate new quantity
      if (newQuantity > maxQty) {
        throw new BadRequestException(
          `Total quantity would exceed maximum allowed (${maxQty})`,
        );
      }

      if (newQuantity > product.stock) {
        throw new BadRequestException(
          `Total quantity would exceed available stock (${product.stock})`,
        );
      }

      await this.updateItemQuantity(cart.id, existingItem.id, newQuantity);
    } else {
      // Add new item to cart with price locking
      const subtotal = product.price.mul(dto.quantity);
      const total = subtotal; // No discount initially

      await this.prisma.cartItem.create({
        data: {
          cartId: cart.id,
          productId: dto.productId,
          quantity: dto.quantity,
          price: product.price, // Lock price
          originalPrice: product.price,
          subtotal,
          total,
          customization: dto.customization,
          productSnapshot: {
            name: product.name,
            slug: product.slug,
            images: product.images,
            price: product.price.toString(),
          },
        },
      });
    }

    // Update cart totals and activity
    await this.calculateTotals(cart.id);

    // Invalidate cache after update
    await this.cache.invalidateCart(userId, sessionId);

    // Return updated cart
    return this.getOrCreateCart(userId, sessionId);
  }

  /**
   * Update cart item quantity or customization
   * @param cartId - Cart ID
   * @param itemId - Cart item ID
   * @param dto - Update data
   * @returns Updated cart
   */
  async updateItem(
    cartId: string,
    itemId: string,
    dto: UpdateCartItemDto,
  ): Promise<CartResponseDto> {
    // Verify item belongs to cart
    const item = await this.prisma.cartItem.findUnique({
      where: { id: itemId },
      include: { product: true },
    });

    if (!item) {
      throw new NotFoundException('Cart item not found');
    }

    if (item.cartId !== cartId) {
      throw new BadRequestException('Cart item does not belong to this cart');
    }

    // Validate stock
    if (dto.quantity > item.product.stock) {
      throw new BadRequestException(
        `Insufficient stock. Available: ${item.product.stock}`,
      );
    }

    // Validate quantity limits
    const maxQty = item.product.maxCartQty || item.product.stock;
    if (dto.quantity > maxQty) {
      throw new BadRequestException(
        `Quantity exceeds maximum allowed (${maxQty})`,
      );
    }

    // Update item
    await this.updateItemQuantity(cartId, itemId, dto.quantity, dto.customization);

    // Invalidate cache
    const cartData = await this.prisma.cart.findUnique({ where: { id: cartId } });
    await this.cache.invalidateCart(cartData?.userId, cartData?.sessionId);

    // Return updated cart
    const cart = await this.prisma.cart.findUnique({
      where: { id: cartId },
      include: {
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                slug: true,
                images: true,
                stock: true,
                price: true,
                isActive: true,
              },
            },
          },
        },
      },
    });

    return this.formatCartResponse(cart!);
  }

  /**
   * Remove item from cart
   * @param cartId - Cart ID
   * @param itemId - Cart item ID
   */
  async removeItem(cartId: string, itemId: string): Promise<void> {
    // Verify item belongs to cart
    const item = await this.prisma.cartItem.findUnique({
      where: { id: itemId },
    });

    if (!item) {
      throw new NotFoundException('Cart item not found');
    }

    if (item.cartId !== cartId) {
      throw new BadRequestException('Cart item does not belong to this cart');
    }

    // Delete item
    await this.prisma.cartItem.delete({
      where: { id: itemId },
    });

    // Update cart totals
    await this.calculateTotals(cartId);

    // Invalidate cache
    const cart = await this.prisma.cart.findUnique({ where: { id: cartId } });
    await this.cache.invalidateCart(cart?.userId, cart?.sessionId);
  }

  /**
   * Clear all items from cart
   * @param cartId - Cart ID
   */
  async clearCart(cartId: string): Promise<void> {
    await this.prisma.cartItem.deleteMany({
      where: { cartId },
    });

    // Reset cart totals
    const cart = await this.prisma.cart.update({
      where: { id: cartId },
      data: {
        subtotal: 0,
        tax: 0,
        discount: 0,
        total: 0,
        lastActivityAt: new Date(),
      },
    });

    // Invalidate cache
    await this.cache.invalidateCart(cart.userId, cart.sessionId);
  }

  /**
   * Get cart summary (item count, total, availability)
   * @param userId - User ID
   * @param sessionId - Session ID
   * @returns Cart summary
   */
  async getCartSummary(
    userId?: string,
    sessionId?: string,
  ): Promise<CartSummaryResponseDto> {
    const cart = await this.prisma.cart.findFirst({
      where: {
        ...(userId ? { userId } : { sessionId }),
        status: CartStatus.ACTIVE,
      },
      include: {
        items: true,
      },
    });

    if (!cart) {
      return {
        itemCount: 0,
        total: 0,
        hasUnavailableItems: false,
      };
    }

    const hasUnavailableItems = cart.items.some((item) => !item.isAvailable);

    return {
      itemCount: cart.items.length,
      total: cart.total,
      hasUnavailableItems,
    };
  }

  /**
   * Calculate and update cart totals
   * @param cartId - Cart ID
   */
  async calculateTotals(cartId: string): Promise<void> {
    const cart = await this.prisma.cart.findUnique({
      where: { id: cartId },
      include: { items: true },
    });

    if (!cart) {
      throw new NotFoundException('Cart not found');
    }

    // Calculate subtotal from all items
    const subtotal = cart.items.reduce(
      (sum, item) => sum.add(item.total),
      new Prisma.Decimal(0),
    );

    // TODO: Implement tax calculation based on region
    const tax = new Prisma.Decimal(0);

    // TODO: Implement shipping calculation
    const shipping = new Prisma.Decimal(0);

    // Calculate final total
    const total = subtotal.add(tax).add(shipping).sub(cart.discount);

    // Update cart
    await this.prisma.cart.update({
      where: { id: cartId },
      data: {
        subtotal,
        tax,
        shipping,
        total,
        lastActivityAt: new Date(),
      },
    });
  }

  /**
   * Validate cart items (stock availability, price changes)
   * @param cartId - Cart ID
   * @returns Validation results
   */
  async validateCart(cartId: string) {
    const cart = await this.prisma.cart.findUnique({
      where: { id: cartId },
      include: {
        items: {
          include: { product: true },
        },
      },
    });

    if (!cart) {
      throw new NotFoundException('Cart not found');
    }

    const validationResults = await Promise.all(
      cart.items.map(async (item) => {
        const product = item.product;
        const isAvailable = product.isActive && product.stock >= item.quantity;
        const priceChanged = !product.price.equals(item.price);

        // Update item availability
        if (!isAvailable && item.isAvailable) {
          await this.prisma.cartItem.update({
            where: { id: item.id },
            data: {
              isAvailable: false,
              unavailableReason:
                !product.isActive ? 'Product no longer available' : 'Out of stock',
            },
          });
        }

        return {
          itemId: item.id,
          productId: product.id,
          isAvailable,
          currentStock: product.stock,
          requestedQuantity: item.quantity,
          priceChanged,
          oldPrice: priceChanged ? item.price.toNumber() : undefined,
          newPrice: priceChanged ? product.price.toNumber() : undefined,
        };
      }),
    );

    const valid = validationResults.every(
      (result) => result.isAvailable && !result.priceChanged,
    );

    return {
      valid,
      items: validationResults,
    };
  }

  /**
   * Helper: Update item quantity and recalculate totals
   */
  private async updateItemQuantity(
    cartId: string,
    itemId: string,
    quantity: number,
    customization?: any,
  ): Promise<void> {
    const item = await this.prisma.cartItem.findUnique({
      where: { id: itemId },
    });

    if (!item) {
      throw new NotFoundException('Cart item not found');
    }

    const subtotal = item.price.mul(quantity);
    const total = subtotal.sub(item.discount);

    await this.prisma.cartItem.update({
      where: { id: itemId },
      data: {
        quantity,
        subtotal,
        total,
        ...(customization && { customization }),
      },
    });

    await this.calculateTotals(cartId);
  }

  /**
   * Merge guest cart into user cart when user logs in
   * @param userId - User ID (authenticated user)
   * @param guestSessionId - Guest session ID to merge from
   * @returns Merged user cart
   */
  async mergeGuestCart(
    userId: string,
    guestSessionId: string,
  ): Promise<CartResponseDto> {
    this.logger.log(
      `Merging guest cart (session: ${guestSessionId}) into user cart (userId: ${userId})`,
    );

    // Get guest cart
    const guestCart = await this.prisma.cart.findFirst({
      where: {
        sessionId: guestSessionId,
        status: CartStatus.ACTIVE,
      },
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    if (!guestCart) {
      this.logger.log('No guest cart found to merge');
      // Just return user's cart (create if doesn't exist)
      return this.getOrCreateCart(userId);
    }

    if (guestCart.items.length === 0) {
      this.logger.log('Guest cart is empty, marking as merged');
      // Mark empty guest cart as merged
      await this.prisma.cart.update({
        where: { id: guestCart.id },
        data: {
          status: CartStatus.MERGED,
          convertedAt: new Date(),
        },
      });
      return this.getOrCreateCart(userId);
    }

    // Get or create user cart
    let userCart = await this.prisma.cart.findFirst({
      where: {
        userId,
        status: CartStatus.ACTIVE,
      },
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    if (!userCart) {
      // Create new user cart
      userCart = await this.prisma.cart.create({
        data: {
          userId,
          status: CartStatus.ACTIVE,
        },
        include: {
          items: {
            include: {
              product: true,
            },
          },
        },
      });
    }

    // Merge items from guest cart to user cart
    const mergeResults = {
      itemsAdded: 0,
      quantitiesMerged: 0,
      skippedItems: 0,
    };

    for (const guestItem of guestCart.items) {
      try {
        // Check if item already exists in user cart
        const existingUserItem = await this.prisma.cartItem.findUnique({
          where: {
            cartId_productId: {
              cartId: userCart.id,
              productId: guestItem.productId,
            },
          },
        });

        if (existingUserItem) {
          // Item exists - merge quantities (respect maxCartQty)
          const product = guestItem.product;
          const maxQty = product.maxCartQty || product.stock;
          const newQuantity = Math.min(
            existingUserItem.quantity + guestItem.quantity,
            maxQty,
            product.stock,
          );

          await this.prisma.cartItem.update({
            where: { id: existingUserItem.id },
            data: {
              quantity: newQuantity,
              subtotal: product.price.mul(newQuantity),
              total: product.price.mul(newQuantity),
            },
          });

          mergeResults.quantitiesMerged++;
          this.logger.debug(
            `Merged quantities for product ${guestItem.productId}: ${existingUserItem.quantity} + ${guestItem.quantity} = ${newQuantity}`,
          );
        } else {
          // Item doesn't exist - add to user cart
          const product = guestItem.product;

          // Validate stock and limits
          if (!product.isActive) {
            this.logger.warn(
              `Skipping inactive product ${product.id} during merge`,
            );
            mergeResults.skippedItems++;
            continue;
          }

          if (product.stock < guestItem.quantity) {
            this.logger.warn(
              `Insufficient stock for product ${product.id} during merge. Available: ${product.stock}, Requested: ${guestItem.quantity}`,
            );
            mergeResults.skippedItems++;
            continue;
          }

          // Create new item in user cart
          await this.prisma.cartItem.create({
            data: {
              cartId: userCart.id,
              productId: guestItem.productId,
              quantity: guestItem.quantity,
              price: guestItem.price,
              originalPrice: guestItem.price,
              subtotal: guestItem.subtotal,
              discount: guestItem.discount,
              total: guestItem.total,
              productSnapshot: guestItem.productSnapshot,
              customization: guestItem.customization,
            },
          });

          mergeResults.itemsAdded++;
          this.logger.debug(`Added product ${guestItem.productId} to user cart`);
        }
      } catch (error) {
        this.logger.error(
          `Error merging item ${guestItem.id}: ${error.message}`,
        );
        mergeResults.skippedItems++;
      }
    }

    // Mark guest cart as MERGED
    await this.prisma.cart.update({
      where: { id: guestCart.id },
      data: {
        status: CartStatus.MERGED,
        convertedAt: new Date(),
      },
    });

    // Recalculate totals for user cart
    await this.calculateTotals(userCart.id);

    // Invalidate both caches
    await this.cache.invalidateCart(userId, undefined);
    await this.cache.invalidateCart(undefined, guestSessionId);

    this.logger.log(
      `✅ Cart merge completed: ${mergeResults.itemsAdded} items added, ${mergeResults.quantitiesMerged} quantities merged, ${mergeResults.skippedItems} items skipped`,
    );

    // Return updated user cart
    return this.getOrCreateCart(userId);
  }

  /**
   * Helper: Format cart response with proper typing
   */
  private formatCartResponse(cart: any): CartResponseDto {
    return {
      id: cart.id,
      userId: cart.userId,
      sessionId: cart.sessionId,
      status: cart.status,
      subtotal: cart.subtotal,
      tax: cart.tax,
      shipping: cart.shipping,
      discount: cart.discount,
      total: cart.total,
      currency: cart.currency,
      itemCount: cart.items?.length || 0,
      items: cart.items || [],
      expiresAt: cart.expiresAt,
      convertedAt: cart.convertedAt,
      abandonedAt: cart.abandonedAt,
      lastActivityAt: cart.lastActivityAt,
      metadata: cart.metadata,
      createdAt: cart.createdAt,
      updatedAt: cart.updatedAt,
    };
  }
}
