# Auth Guards & Decorators Usage Guide

## Overview
This guide demonstrates how to use the authentication guards and decorators in the MASH Backend API.

## Available Guards

### 1. ClerkAuthGuard
Main authentication guard that validates Clerk JWT tokens.

```typescript
import { Controller, Get, UseGuards } from '@nestjs/common';
import { ClerkAuthGuard } from './guards/clerk-auth.guard';

@Controller('protected')
@UseGuards(ClerkAuthGuard)
export class ProtectedController {
  @Get()
  getProtectedResource() {
    return { message: 'This route requires authentication' };
  }
}
```

### 2. RolesGuard
Enforces role-based access control (RBAC).

```typescript
import { Controller, Get, UseGuards } from '@nestjs/common';
import { ClerkAuthGuard } from './guards/clerk-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { Roles } from './decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@Controller('admin')
@UseGuards(ClerkAuthGuard, RolesGuard)
export class AdminController {
  @Get('dashboard')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  getAdminDashboard() {
    return { message: 'Admin only content' };
  }
}
```

### 3. PermissionsGuard
Fine-grained permission-based access control.

**⚠️ Note**: Currently in stub mode until Phase 2 RBAC tables are implemented.

```typescript
import { Controller, Post, UseGuards } from '@nestjs/common';
import { ClerkAuthGuard } from './guards/clerk-auth.guard';
import { PermissionsGuard } from './guards/permissions.guard';
import { Permissions } from './decorators/permissions.decorator';

@Controller('devices')
@UseGuards(ClerkAuthGuard, PermissionsGuard)
export class DevicesController {
  @Post()
  @Permissions('devices:create')
  createDevice() {
    return { message: 'Device created' };
  }

  @Get()
  @Permissions('devices:read')
  listDevices() {
    return { message: 'Devices list' };
  }
}
```

## Available Decorators

### 1. @Public()
Marks routes as publicly accessible (no authentication required).

```typescript
import { Controller, Get } from '@nestjs/common';
import { Public } from './decorators/public.decorator';

@Controller('health')
export class HealthController {
  @Public()
  @Get()
  check() {
    return { status: 'ok' };
  }
}
```

### 2. @CurrentUser()
Extracts the authenticated user from the request.

```typescript
import { Controller, Get, UseGuards } from '@nestjs/common';
import { ClerkAuthGuard } from './guards/clerk-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';

@Controller('profile')
@UseGuards(ClerkAuthGuard)
export class ProfileController {
  @Get()
  getProfile(@CurrentUser() user: any) {
    return { user };
  }

  @Get('email')
  getEmail(@CurrentUser('email') email: string) {
    return { email };
  }

  @Get('id')
  getUserId(@CurrentUser('id') userId: string) {
    return { userId };
  }
}
```

### 3. @Roles()
Specifies required user roles for route access.

```typescript
import { Controller, Delete, UseGuards } from '@nestjs/common';
import { ClerkAuthGuard } from './guards/clerk-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { Roles } from './decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@Controller('users')
@UseGuards(ClerkAuthGuard, RolesGuard)
export class UsersController {
  @Delete(':id')
  @Roles(UserRole.SUPER_ADMIN)
  deleteUser(@Param('id') id: string) {
    return { message: `User ${id} deleted` };
  }

  @Get('all')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  getAllUsers() {
    return { message: 'All users' };
  }
}
```

### 4. @Permissions()
Specifies required permissions for fine-grained access control.

Permission format: `"resource:action"`

```typescript
import { Controller, UseGuards } from '@nestjs/common';
import { ClerkAuthGuard } from './guards/clerk-auth.guard';
import { PermissionsGuard } from './guards/permissions.guard';
import { Permissions } from './decorators/permissions.decorator';

@Controller('orders')
@UseGuards(ClerkAuthGuard, PermissionsGuard)
export class OrdersController {
  @Get()
  @Permissions('orders:read')
  listOrders() {
    return { message: 'Orders list' };
  }

  @Post()
  @Permissions('orders:create')
  createOrder() {
    return { message: 'Order created' };
  }

  @Put(':id')
  @Permissions('orders:update')
  updateOrder() {
    return { message: 'Order updated' };
  }

  @Delete(':id')
  @Permissions('orders:delete')
  deleteOrder() {
    return { message: 'Order deleted' };
  }
}
```

## Common Patterns

### Pattern 1: Combining Multiple Guards
Guards execute in the order they are specified.

```typescript
@Controller('api')
@UseGuards(ClerkAuthGuard, RolesGuard, PermissionsGuard)
export class ApiController {
  @Get('sensitive')
  @Roles(UserRole.ADMIN)
  @Permissions('api:read', 'api:sensitive')
  getSensitiveData(@CurrentUser() user: any) {
    return { data: 'sensitive', user };
  }
}
```

### Pattern 2: Public Routes in Protected Controllers
Use `@Public()` to bypass authentication for specific routes.

```typescript
@Controller('products')
@UseGuards(ClerkAuthGuard)
export class ProductsController {
  @Public()
  @Get()
  listPublicProducts() {
    return { message: 'Public product list' };
  }

  @Post()
  @Roles(UserRole.SELLER, UserRole.ADMIN)
  createProduct(@CurrentUser('id') userId: string) {
    return { message: 'Product created', userId };
  }
}
```

### Pattern 3: Global Guard with Public Routes
Apply ClerkAuthGuard globally and use `@Public()` for exceptions.

```typescript
// main.ts
import { ClerkAuthGuard } from './modules/auth/guards/clerk-auth.guard';
import { Reflector } from '@nestjs/core';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const reflector = app.get(Reflector);
  app.useGlobalGuards(new ClerkAuthGuard(reflector));
  await app.listen(3000);
}
```

```typescript
// controller.ts
@Controller('auth')
export class AuthController {
  @Public()
  @Post('login')
  login() {
    return { message: 'Login endpoint' };
  }

  @Public()
  @Post('register')
  register() {
    return { message: 'Register endpoint' };
  }

  @Get('me')
  getMe(@CurrentUser() user: any) {
    return { user };
  }
}
```

### Pattern 4: Role and Permission Combinations
Require both specific role AND specific permissions.

```typescript
@Controller('admin/settings')
@UseGuards(ClerkAuthGuard, RolesGuard, PermissionsGuard)
export class AdminSettingsController {
  @Put('system')
  @Roles(UserRole.SUPER_ADMIN)
  @Permissions('settings:system:write')
  updateSystemSettings(@CurrentUser() user: any) {
    return { message: 'System settings updated' };
  }
}
```

## Guard Execution Order

1. **ClerkAuthGuard** - Validates authentication token
2. **RolesGuard** - Checks user role matches required role(s)
3. **PermissionsGuard** - Validates fine-grained permissions (Phase 2)

## Permission Naming Convention

Use the format `"resource:action"` or `"resource:subresource:action"`:

- `devices:read` - Read devices
- `devices:create` - Create devices
- `devices:update` - Update devices
- `devices:delete` - Delete devices
- `orders:payments:process` - Process order payments
- `users:profile:update` - Update user profiles
- `admin:settings:system` - Access system settings

## Available UserRole Enum

```typescript
enum UserRole {
  BUYER = 'BUYER',
  SELLER = 'SELLER',
  ADMIN = 'ADMIN',
  SUPER_ADMIN = 'SUPER_ADMIN',
}
```

## Notes

- **PermissionsGuard** is currently a stub implementation (returns true for all authenticated users)
- Full RBAC implementation requires Phase 2 database tables (Permission, Role, UserRole, RolePermission)
- Always use `ClerkAuthGuard` as the first guard in the chain
- Use `@Public()` to explicitly mark routes as public
- `@CurrentUser()` can extract the entire user object or specific properties

## Next Steps

1. Complete Phase 2 RBAC database migration
2. Implement full PermissionsGuard logic
3. Add permission caching for performance
4. Create admin UI for permission management
5. Deprecate FirebaseAuthGuard after full Clerk migration
