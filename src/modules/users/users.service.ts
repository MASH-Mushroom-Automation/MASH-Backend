import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UserPreferencesDto } from './dto/user-preferences.dto';
import { CreateAddressDto } from './dto/create-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';
import { PaginationQueryDto } from './dto/pagination-query.dto';
import { UserFilterQueryDto } from './dto/user-filter-query.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findAll(query: UserFilterQueryDto) {
    const { page = 1, limit = 10, role, status, search } = query;
    const skip = (page - 1) * limit;

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

    return {
      data: users,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async create(createUserDto: CreateUserDto) {
    // Check if user already exists
    const existingUser = await this.prisma.user.findFirst({
      where: {
        OR: [
          { email: createUserDto.email },
          { username: createUserDto.username },
        ],
      },
    });

    if (existingUser) {
      throw new BadRequestException(
        'User with this email or username already exists',
      );
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

  async findOne(id: string, currentUser: any) {
    // Check permissions - users can only see their own data unless admin
    if (
      currentUser.id !== id &&
      !['ADMIN', 'SUPER_ADMIN'].includes(currentUser.role)
    ) {
      throw new ForbiddenException('You can only view your own profile');
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

    return user;
  }

  async update(id: string, updateUserDto: UpdateUserDto, currentUser: any) {
    // Check permissions
    if (
      currentUser.id !== id &&
      !['ADMIN', 'SUPER_ADMIN'].includes(currentUser.role)
    ) {
      throw new ForbiddenException('You can only update your own profile');
    }

    // If password is being updated, hash it
    if (updateUserDto.password) {
      updateUserDto.password = await bcrypt.hash(updateUserDto.password, 10);
    }

    return this.prisma.user.update({
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
  }

  async remove(id: string) {
    // Soft delete - User model doesn't have deletedAt field
    // We'll use isActive instead
    return this.prisma.user.update({
      where: { id },
      data: { isActive: false },
      select: {
        id: true,
        email: true,
        isActive: true,
      },
    });
  }

  async getProfile(id: string) {
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

    return user;
  }

  async updateProfile(id: string, updateProfileDto: UpdateProfileDto) {
    // Update profile-specific fields only
    // Note: bio field doesn't exist in schema - only firstName, lastName, phone are valid
    return this.prisma.user.update({
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
  }

  async uploadAvatar(id: string, file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    // In production, you would upload to cloud storage (S3, Cloudinary, etc.)
    // For now, we'll just save the file path
    const imagePath = `/uploads/avatars/${id}/${file.filename}`;

    return this.prisma.user.update({
      where: { id },
      data: { imageUrl: imagePath },
      select: {
        id: true,
        imageUrl: true,
        updatedAt: true,
      },
    });
  }

  async getPreferences(id: string) {
    // Note: User model doesn't have preferences field
    // Return empty object for now - would need to add to schema
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return {}; // TODO: Add preferences field to User model
  }

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

    return {
      id: user.id,
      preferences: preferencesDto,
      updatedAt: user.updatedAt,
    };
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

  async getAddresses(id: string) {
    const addresses = await this.prisma.address.findMany({
      where: { userId: id },
      orderBy: { isDefault: 'desc' },
    });

    return {
      data: addresses,
      total: addresses.length,
    };
  }

  async addAddress(id: string, createAddressDto: CreateAddressDto) {
    // If this is set as default, unset all other default addresses
    if (createAddressDto.isDefault) {
      await this.prisma.address.updateMany({
        where: { userId: id, isDefault: true },
        data: { isDefault: false },
      });
    }

    // Map DTO fields to schema fields
    return this.prisma.address.create({
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
  }

  async updateAddress(
    id: string,
    addressId: string,
    updateAddressDto: UpdateAddressDto,
  ) {
    // Verify address belongs to user
    const address = await this.prisma.address.findFirst({
      where: { id: addressId, userId: id },
    });

    if (!address) {
      throw new NotFoundException(
        'Address not found or does not belong to user',
      );
    }

    // If setting as default, unset other defaults
    if (updateAddressDto.isDefault) {
      await this.prisma.address.updateMany({
        where: { userId: id, isDefault: true, id: { not: addressId } },
        data: { isDefault: false },
      });
    }

    return this.prisma.address.update({
      where: { id: addressId },
      data: updateAddressDto,
    });
  }
}
