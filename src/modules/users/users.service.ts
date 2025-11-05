import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CacheService } from '../../common/services/cache.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateUserProfileDto } from './dto/update-profile.dto';
import { UserPreferencesDto } from './dto/user-preferences.dto';
import { CreateAddressDto } from './dto/create-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';
import { PaginationQueryDto } from './dto/pagination-query.dto';
import { UserFilterQueryDto } from './dto/user-filter-query.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  // Cache configuration
  private readonly USER_CACHE_PREFIX = 'user';
  private readonly USERS_LIST_CACHE_PREFIX = 'users:list';
  private readonly USER_PREFERENCES_CACHE_PREFIX = 'user:preferences';
  private readonly USER_ADDRESSES_CACHE_PREFIX = 'user:addresses';
  private readonly USER_TTL = 600; // 10 minutes
  private readonly USER_PREFERENCES_TTL = 1800; // 30 minutes (preferences change less frequently)

  constructor(
    private prisma: PrismaService,
    private cacheService: CacheService,
  ) {}

  /**
   * Find all users with filters
   * Phase 2: Cache user listings
   */
  async findAll(query: UserFilterQueryDto) {
    const { page = 1, limit = 10, role, status, search } = query;
    const skip = (page - 1) * limit;

    // Generate cache key
    const cacheKey = `${this.USERS_LIST_CACHE_PREFIX}:${JSON.stringify(query)}`;

    // Try cache first
    const cached = await this.cacheService.get(cacheKey);
    if (cached) {
      return cached;
    }

    const where: any = {};
    if (role) where.role = role;
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { username: { contains: search, mode: 'insensitive' } },
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        select: {
          id: true,
          email: true,
          username: true,
          firstName: true,
          lastName: true,
          role: true,
          imageUrl: true,
          createdAt: true,
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    const result = {
      data: users,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };

    // Cache for 10 minutes
    await this.cacheService.set(cacheKey, result, this.USER_TTL, ['users', 'users:list']);

    return result;
  }

  async create(createUserDto: CreateUserDto) {
    // Check if user already exists
    const existingUser = await this.prisma.user.findFirst({
      where: {
        OR: [{ email: createUserDto.email }, { username: createUserDto.username }],
      },
    });

    if (existingUser) {
      throw new BadRequestException('User with this email or username already exists');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(createUserDto.password, 10);

    // Create user (clerkId is required by schema)
    const user = await this.prisma.user.create({
      data: {
        email: createUserDto.email,
        username: createUserDto.username,
        firstName: createUserDto.firstName,
        lastName: createUserDto.lastName,
        role: createUserDto.role || 'USER',
        clerkId: `temp_${Date.now()}`, // Temporary - should be from Clerk/Firebase
        // Note: password field doesn't exist in schema (handled by Firebase/Clerk)
      },
      select: {
        id: true,
        email: true,
        username: true,
        firstName: true,
        lastName: true,
        role: true,
        createdAt: true,
      },
    });

    return user;
  }

  /**
   * Find user by ID
   * Phase 2: Cache individual user profiles
   */
  async findOne(id: string, currentUser: any) {
    // Check permissions - users can only see their own data unless admin
    if (currentUser.id !== id && !['ADMIN', 'SUPER_ADMIN'].includes(currentUser.role)) {
      throw new ForbiddenException('You can only view your own profile');
    }

    const cacheKey = `${this.USER_CACHE_PREFIX}:${id}`;

    // Try cache first
    const cached = await this.cacheService.get<any>(cacheKey);
    if (cached) {
      return cached;
    }

    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        username: true,
        firstName: true,
        lastName: true,
        role: true,
        imageUrl: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Cache for 10 minutes
    await this.cacheService.set(cacheKey, user, this.USER_TTL, ['users', `user:${id}`]);

    return user;
  }

  /**
   * Update user
   * Phase 2: Invalidate caches on update
   */
  async update(id: string, updateUserDto: UpdateUserDto, currentUser: any) {
    // Check permissions
    if (currentUser.id !== id && !['ADMIN', 'SUPER_ADMIN'].includes(currentUser.role)) {
      throw new ForbiddenException('You can only update your own profile');
    }

    // If password is being updated, hash it
    if (updateUserDto.password) {
      updateUserDto.password = await bcrypt.hash(updateUserDto.password, 10);
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: updateUserDto,
      select: {
        id: true,
        email: true,
        username: true,
        firstName: true,
        lastName: true,
        role: true,
        imageUrl: true,
        updatedAt: true,
      },
    });

    // Invalidate user caches
    await this.cacheService.invalidateByTags(['users', 'users:list', `user:${id}`]);

    return updated;
  }

  /**
   * Remove (soft delete) user
   * Phase 2: Invalidate caches on delete
   */
  async remove(id: string) {
    // Soft delete - User model doesn't have deletedAt field
    // We'll use isActive instead
    const deleted = await this.prisma.user.update({
      where: { id },
      data: { isActive: false },
      select: {
        id: true,
        email: true,
        isActive: true,
      },
    });

    // Invalidate user caches
    await this.cacheService.invalidateByTags(['users', 'users:list', `user:${id}`]);

    return deleted;
  }

  /**
   * Get extended user profile
   * Phase 2: Cache user profiles with relationships
   */
  async getProfile(id: string) {
    const cacheKey = `${this.USER_CACHE_PREFIX}:profile:${id}`;

    // Try cache first
    const cached = await this.cacheService.get<any>(cacheKey);
    if (cached) {
      return cached;
    }

    // Get extended profile with related data
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        devices: {
          take: 5,
          orderBy: { createdAt: 'desc' },
        },
        orders: {
          take: 5,
          orderBy: { createdAt: 'desc' },
        },
        addresses: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Cache for 10 minutes
    await this.cacheService.set(cacheKey, user, this.USER_TTL, [
      'users',
      `user:${id}`,
      'user:profile',
    ]);

    return user;
  }

  /**
   * Update user profile
   * Phase 2: Invalidate caches on profile update
   */
  async updateProfile(id: string, updateProfileDto: UpdateUserProfileDto) {
    // Update profile-specific fields only
    // Note: bio field doesn't exist in schema - only firstName, lastName, phone are valid
    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        firstName: updateProfileDto.firstName,
        lastName: updateProfileDto.lastName,
        phoneNumber: updateProfileDto.phone,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        phoneNumber: true,
        updatedAt: true,
      },
    });

    // Invalidate user caches
    await this.cacheService.invalidateByTags(['users', `user:${id}`]);

    return updated;
  }

  /**
   * Upload user avatar
   * Phase 2: Invalidate caches on avatar update
   */
  async uploadAvatar(id: string, file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    // In production, you would upload to cloud storage (S3, Cloudinary, etc.)
    // For now, we'll just save the file path
    const imagePath = `/uploads/avatars/${id}/${file.filename}`;

    const updated = await this.prisma.user.update({
      where: { id },
      data: { imageUrl: imagePath },
      select: {
        id: true,
        imageUrl: true,
        updatedAt: true,
      },
    });

    // Invalidate user caches
    await this.cacheService.invalidateByTags(['users', `user:${id}`]);

    return updated;
  }

  /**
   * Get user preferences
   * Phase 2: Cache user preferences (30 min TTL - changes infrequently)
   */
  async getPreferences(id: string) {
    const cacheKey = `${this.USER_PREFERENCES_CACHE_PREFIX}:${id}`;

    // Try cache first (longer TTL for preferences)
    const cached = await this.cacheService.get<any>(cacheKey);
    if (cached) {
      return cached;
    }

    // Note: User model doesn't have preferences field
    // Return empty object for now - would need to add to schema
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const preferences = {}; // TODO: Add preferences field to User model

    // Cache preferences for 30 minutes
    await this.cacheService.set(cacheKey, preferences, this.USER_PREFERENCES_TTL, [
      'users',
      `user:${id}`,
      'user:preferences',
    ]);

    return preferences;
  }

  /**
   * Update user preferences
   * Phase 2: Invalidate preference caches on update
   */
  async updatePreferences(id: string, preferencesDto: UserPreferencesDto) {
    // Note: User model doesn't have preferences field
    // Just verify user exists for now
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, updatedAt: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const result = {
      id: user.id,
      preferences: preferencesDto,
      updatedAt: user.updatedAt,
    };

    // Invalidate preference caches
    await this.cacheService.invalidateByTags([`user:${id}`, 'user:preferences']);

    return result;
  }

  async getUserDevices(id: string) {
    const devices = await this.prisma.device.findMany({
      where: { userId: id },
      orderBy: { createdAt: 'desc' },
    });

    return {
      data: devices,
      total: devices.length,
    };
  }

  async getUserOrders(id: string, query: PaginationQueryDto) {
    const { page = 1, limit = 10 } = query;
    const skip = (page - 1) * limit;

    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where: { userId: id },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.order.count({ where: { userId: id } }),
    ]);

    return {
      data: orders,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get user addresses
   * Phase 2: Cache user addresses
   */
  async getAddresses(id: string) {
    const cacheKey = `${this.USER_ADDRESSES_CACHE_PREFIX}:${id}`;

    // Try cache first
    const cached = await this.cacheService.get<any>(cacheKey);
    if (cached) {
      return cached;
    }

    const addresses = await this.prisma.address.findMany({
      where: { userId: id },
      orderBy: { isDefault: 'desc' },
    });

    const result = {
      data: addresses,
      total: addresses.length,
    };

    // Cache for 10 minutes
    await this.cacheService.set(cacheKey, result, this.USER_TTL, [
      'users',
      `user:${id}`,
      'user:addresses',
    ]);

    return result;
  }

  /**
   * Add user address
   * Phase 2: Invalidate address caches on create
   */
  async addAddress(id: string, createAddressDto: CreateAddressDto) {
    // If this is set as default, unset all other default addresses
    if (createAddressDto.isDefault) {
      await this.prisma.address.updateMany({
        where: { userId: id, isDefault: true },
        data: { isDefault: false },
      });
    }

    // Map DTO fields to schema fields
    const address = await this.prisma.address.create({
      data: {
        userId: id,
        type: 'home', // default type
        firstName: '', // TODO: Get from user profile
        lastName: '', // TODO: Get from user profile
        street1: createAddressDto.street,
        city: createAddressDto.city,
        state: createAddressDto.state,
        postalCode: createAddressDto.zipCode,
        country: createAddressDto.country,
        isDefault: createAddressDto.isDefault || false,
      },
    });

    // Invalidate address caches
    await this.cacheService.invalidateByTags([`user:${id}`, 'user:addresses']);

    return address;
  }

  /**
   * Update user address
   * Phase 2: Invalidate address caches on update
   */
  async updateAddress(id: string, addressId: string, updateAddressDto: UpdateAddressDto) {
    // Verify address belongs to user
    const address = await this.prisma.address.findFirst({
      where: { id: addressId, userId: id },
    });

    if (!address) {
      throw new NotFoundException('Address not found or does not belong to user');
    }

    // If setting as default, unset other defaults
    if (updateAddressDto.isDefault) {
      await this.prisma.address.updateMany({
        where: { userId: id, isDefault: true, id: { not: addressId } },
        data: { isDefault: false },
      });
    }

    const updated = await this.prisma.address.update({
      where: { id: addressId },
      data: updateAddressDto,
    });

    // Invalidate address caches
    await this.cacheService.invalidateByTags([`user:${id}`, 'user:addresses']);

    return updated;
  }
}
