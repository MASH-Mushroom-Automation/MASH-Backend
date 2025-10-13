import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Request,
  UseGuards,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiConsumes,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateUserProfileDto } from './dto/update-profile.dto';
import { UserPreferencesDto } from './dto/user-preferences.dto';
import { CreateAddressDto } from './dto/create-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';
import { PaginationQueryDto } from './dto/pagination-query.dto';
import { UserFilterQueryDto } from './dto/user-filter-query.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { SelectableFields } from '../../common/decorators/selectable-fields.decorator';
import { FileValidationService } from '../../common/services/file-validation.service';

@ApiTags('users')
@Controller('users')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly fileValidationService: FileValidationService,
  ) {}

  // 1. GET /users - List users (admin only)
  @Get()
  @Roles('ADMIN', 'SUPER_ADMIN')
  @UseGuards(RolesGuard)
  @SelectableFields({
    allowedFields: [
      'id',
      'email',
      'firstName',
      'lastName',
      'role',
      'isActive',
      'avatar',
      'phone',
      'createdAt',
      'updatedAt',
    ],
    requiredFields: ['id', 'email'],
    defaultFields: ['id', 'email', 'firstName', 'lastName', 'role', 'isActive'],
    maxFields: 12,
  })
  @ApiOperation({
    summary: 'List all users with pagination and filters',
    description: `
**Authentication Required**: This endpoint requires a valid JWT token with ADMIN or SUPER_ADMIN role.

**How to test in Swagger**:
1. Start the backend: \`npm run start:dev\`
2. Login using POST /api/v1/auth/login
3. Copy the 'accessToken' from response
4. Click "Authorize" 🔒 button at top
5. Paste token and click "Authorize"
6. Now test this endpoint

**Required Role**: ADMIN or SUPER_ADMIN
    `,
  })
  @ApiResponse({
    status: 200,
    description: 'Users retrieved successfully',
    schema: {
      example: {
        success: true,
        data: [
          {
            id: 'user_1',
            email: 'admin@example.com',
            firstName: 'Admin',
            lastName: 'User',
            role: 'ADMIN',
            isActive: true,
          },
        ],
        meta: {
          total: 1,
          page: 1,
          limit: 10,
        },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - No token or invalid token',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin access only',
  })
  async findAll(@Query() query: UserFilterQueryDto) {
    return this.usersService.findAll(query);
  }

  // 2. POST /users - Create user (admin only)
  @Post()
  @Roles('ADMIN', 'SUPER_ADMIN')
  @UseGuards(RolesGuard)
  @ApiOperation({
    summary: 'Create new user',
    description: `
**Authentication Required**: This endpoint requires a valid JWT token with ADMIN or SUPER_ADMIN role.

**How to authenticate in Swagger**:
1. First, login using POST /api/v1/auth/login or POST /api/v1/auth/register
2. Copy the 'accessToken' from the response
3. Click the "Authorize" button (🔒) at the top of this page
4. Paste the token in the "Value" field
5. Click "Authorize" then "Close"
6. Now you can test this endpoint

**Required Role**: ADMIN or SUPER_ADMIN
    `,
  })
  @ApiResponse({
    status: 201,
    description: 'User created successfully',
    schema: {
      example: {
        success: true,
        data: {
          id: 'user_2abc123xyz',
          email: 'user@example.com',
          username: 'john_doe',
          firstName: 'John',
          lastName: 'Doe',
          role: 'USER',
          isActive: true,
          createdAt: '2024-12-15T10:30:00.000Z',
          updatedAt: '2024-12-15T10:30:00.000Z',
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid input data',
    schema: {
      example: {
        success: false,
        error: 'Validation failed',
        message: ['email must be a valid email address'],
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - No token or invalid token',
    schema: {
      example: {
        success: false,
        error: 'Unauthorized',
        message: 'You must be logged in to access this endpoint',
      },
    },
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin access only',
    schema: {
      example: {
        success: false,
        error: 'Forbidden',
        message: 'You need ADMIN role to access this endpoint',
      },
    },
  })
  async create(@Body() createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
  }

  // 3. GET /users/:id - Get user details
  @Get(':id')
  @SelectableFields({
    allowedFields: [
      'id',
      'email',
      'firstName',
      'lastName',
      'role',
      'isActive',
      'avatar',
      'phone',
      'emailVerified',
      'twoFactorEnabled',
      'createdAt',
      'updatedAt',
    ],
    requiredFields: ['id'],
    defaultFields: [
      'id',
      'email',
      'firstName',
      'lastName',
      'role',
      'isActive',
      'avatar',
    ],
    maxFields: 15,
  })
  @ApiOperation({ summary: 'Get user by ID' })
  @ApiResponse({ status: 200, description: 'User retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Can only view own profile',
  })
  @ApiResponse({ status: 404, description: 'User not found' })
  async findOne(@Param('id') id: string, @Request() req) {
    return this.usersService.findOne(id, req.user);
  }

  // 4. PUT /users/:id - Update user
  @Put(':id')
  @ApiOperation({ summary: 'Update user information' })
  @ApiResponse({ status: 200, description: 'User updated successfully' })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Can only update own profile',
  })
  @ApiResponse({ status: 404, description: 'User not found' })
  async update(
    @Param('id') id: string,
    @Body() updateUserDto: UpdateUserDto,
    @Request() req,
  ) {
    return this.usersService.update(id, updateUserDto, req.user);
  }

  // 5. DELETE /users/:id - Soft delete
  @Delete(':id')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: 'Soft delete user' })
  @ApiResponse({ status: 200, description: 'User deleted successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin access only' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async remove(@Param('id') id: string) {
    return this.usersService.remove(id);
  }

  // 6. GET /users/:id/profile - Get profile
  @Get(':id/profile')
  @ApiOperation({ summary: 'Get user profile with extended information' })
  @ApiResponse({ status: 200, description: 'Profile retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async getProfile(@Param('id') id: string) {
    return this.usersService.getProfile(id);
  }

  // 7. PUT /users/:id/profile - Update profile
  @Put(':id/profile')
  @ApiOperation({ summary: 'Update user profile (Admin)' })
  @ApiResponse({ status: 200, description: 'Profile updated successfully' })
  async updateProfile(
    @Param('id') id: string,
    @Body() updateProfileDto: UpdateUserProfileDto,
  ) {
    return this.usersService.updateProfile(id, updateProfileDto);
  }

  // 8. POST /users/:id/avatar - Upload avatar
  @Post(':id/avatar')
  @UseInterceptors(
    FileInterceptor('avatar', {
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB
      },
    }),
  )
  @ApiOperation({ summary: 'Upload user avatar image' })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({ status: 200, description: 'Avatar uploaded successfully' })
  @ApiResponse({
    status: 400,
    description:
      'Invalid file (wrong format, size exceeded, dangerous type, MIME spoofing)',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async uploadAvatar(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    // Validate file before processing (security layer)
    await this.fileValidationService.validateImage(file, {
      maxSize: 5 * 1024 * 1024, // 5MB limit for avatars
    });

    return this.usersService.uploadAvatar(id, file);
  }

  // 9. GET /users/:id/preferences - Get preferences
  @Get(':id/preferences')
  @ApiOperation({ summary: 'Get user preferences' })
  @ApiResponse({
    status: 200,
    description: 'Preferences retrieved successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async getPreferences(@Param('id') id: string) {
    return this.usersService.getPreferences(id);
  }

  // 10. PUT /users/:id/preferences - Update preferences
  @Put(':id/preferences')
  @ApiOperation({ summary: 'Update user preferences' })
  @ApiResponse({
    status: 200,
    description: 'Preferences updated successfully',
  })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async updatePreferences(
    @Param('id') id: string,
    @Body() preferencesDto: UserPreferencesDto,
  ) {
    return this.usersService.updatePreferences(id, preferencesDto);
  }

  // 11. GET /users/:id/devices - User's devices
  @Get(':id/devices')
  @ApiOperation({ summary: "Get user's IoT devices" })
  @ApiResponse({ status: 200, description: 'Devices retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async getUserDevices(@Param('id') id: string) {
    return this.usersService.getUserDevices(id);
  }

  // 12. GET /users/:id/orders - User's orders
  @Get(':id/orders')
  @ApiOperation({ summary: "Get user's order history" })
  @ApiResponse({ status: 200, description: 'Orders retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async getUserOrders(
    @Param('id') id: string,
    @Query() query: PaginationQueryDto,
  ) {
    return this.usersService.getUserOrders(id, query);
  }

  // 13. GET /users/:id/addresses - User's addresses
  @Get(':id/addresses')
  @ApiOperation({ summary: "Get user's saved addresses" })
  @ApiResponse({
    status: 200,
    description: 'Addresses retrieved successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async getAddresses(@Param('id') id: string) {
    return this.usersService.getAddresses(id);
  }

  // 14. POST /users/:id/addresses - Add address
  @Post(':id/addresses')
  @ApiOperation({ summary: 'Add new address for user' })
  @ApiResponse({ status: 201, description: 'Address created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async addAddress(
    @Param('id') id: string,
    @Body() createAddressDto: CreateAddressDto,
  ) {
    return this.usersService.addAddress(id, createAddressDto);
  }

  // 15. PUT /users/:id/addresses/:addressId - Update address
  @Put(':id/addresses/:addressId')
  @ApiOperation({ summary: 'Update existing address' })
  @ApiResponse({ status: 200, description: 'Address updated successfully' })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Address not found' })
  async updateAddress(
    @Param('id') id: string,
    @Param('addressId') addressId: string,
    @Body() updateAddressDto: UpdateAddressDto,
  ) {
    return this.usersService.updateAddress(id, addressId, updateAddressDto);
  }
}
