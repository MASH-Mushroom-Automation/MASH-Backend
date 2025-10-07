# Auth Quick Reference Card

## 🔐 Guards

### ClerkAuthGuard
```typescript
@UseGuards(ClerkAuthGuard)
```
**Purpose**: Validates Clerk JWT tokens  
**Respects**: `@Public()` decorator  
**Use**: Main authentication guard

### RolesGuard
```typescript
@UseGuards(ClerkAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
```
**Purpose**: Role-based access control  
**Requires**: `@Roles()` decorator  
**Use**: Restrict by user role

### PermissionsGuard ⚠️ STUB
```typescript
@UseGuards(ClerkAuthGuard, PermissionsGuard)
@Permissions('devices:read')
```
**Purpose**: Fine-grained permissions  
**Status**: Stub mode (returns true)  
**Use**: Phase 2 implementation pending

---

## 🎨 Decorators

### @Public()
```typescript
@Public()
@Get()
healthCheck() {}
```
**Purpose**: Skip authentication  
**Use**: Public endpoints only

### @CurrentUser()
```typescript
getProfile(@CurrentUser() user: any) {}
getEmail(@CurrentUser('email') email: string) {}
```
**Purpose**: Extract user from request  
**Variants**: Full user or specific property

### @Roles()
```typescript
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
```
**Purpose**: Specify required roles  
**Enum**: UserRole from @prisma/client

### @Permissions()
```typescript
@Permissions('devices:read', 'devices:update')
```
**Purpose**: Specify required permissions  
**Format**: `"resource:action"`

---

## 📝 Common Patterns

### Pattern 1: Basic Auth
```typescript
@Controller('api')
@UseGuards(ClerkAuthGuard)
export class ApiController {
  @Get()
  getData(@CurrentUser() user: any) {
    return { user };
  }
}
```

### Pattern 2: Public Endpoint
```typescript
@Controller('public')
export class PublicController {
  @Public()
  @Get()
  getData() {
    return { data: 'public' };
  }
}
```

### Pattern 3: Role-Based
```typescript
@Controller('admin')
@UseGuards(ClerkAuthGuard, RolesGuard)
export class AdminController {
  @Get()
  @Roles(UserRole.ADMIN)
  getDashboard() {
    return { message: 'Admin only' };
  }
}
```

### Pattern 4: Permission-Based
```typescript
@Controller('devices')
@UseGuards(ClerkAuthGuard, PermissionsGuard)
export class DevicesController {
  @Post()
  @Permissions('devices:create')
  create(@CurrentUser('id') userId: string) {
    return { userId };
  }
}
```

### Pattern 5: Combined Guards
```typescript
@Controller('sensitive')
@UseGuards(ClerkAuthGuard, RolesGuard, PermissionsGuard)
export class SensitiveController {
  @Get()
  @Roles(UserRole.ADMIN)
  @Permissions('sensitive:read')
  getData(@CurrentUser() user: any) {
    return { data: 'sensitive', user };
  }
}
```

---

## 🎯 Guard Execution Order

```
ClerkAuthGuard → RolesGuard → PermissionsGuard
     ↓              ↓              ↓
  Auth Check    Role Check   Permission Check
```

**Always use ClerkAuthGuard first!**

---

## 🔑 UserRole Enum

```typescript
enum UserRole {
  BUYER = 'BUYER',
  SELLER = 'SELLER',
  ADMIN = 'ADMIN',
  SUPER_ADMIN = 'SUPER_ADMIN',
}
```

---

## 🎭 Permission Format

**Format**: `"resource:action"` or `"resource:sub:action"`

**Examples**:
- `devices:read` - Read devices
- `devices:create` - Create devices
- `orders:update` - Update orders
- `admin:settings:system` - System settings

---

## ⚡ Quick Tips

1. **Always use ClerkAuthGuard first** in guard chains
2. **Use @Public() explicitly** for public routes
3. **Combine guards** for layered security
4. **PermissionsGuard is stub** - use RolesGuard for now
5. **@CurrentUser('prop')** for specific properties
6. **Permission caching** coming in Phase 2

---

## 🚨 Important Notes

### PermissionsGuard Status
- ⚠️ **Currently in stub mode**
- Returns `true` for all authenticated users
- Logs warning: "PermissionsGuard is in stub mode"
- Phase 2 will implement actual permission checking

### Migration Path
- FirebaseAuthGuard → ClerkAuthGuard (Phase 1 ✅)
- RolesGuard → Enhanced RBAC (Phase 2 ⏳)
- PermissionsGuard stub → Full implementation (Phase 2 ⏳)

---

## 📚 Documentation

**Full Usage Guide**: `src/modules/auth/GUARDS_DECORATORS_USAGE.md`

**Phase 1 Summary**: `documents/TASK_3_PHASE_1_COMPLETE.md`

**Step Summaries**:
- `documents/TASK_3_STEP_1.3_SUMMARY.md`

---

## 🛠️ Environment Variables

```bash
CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
CLERK_WEBHOOK_SECRET=whsec_...
```

---

## 🧪 Testing Checklist

- [ ] Test ClerkAuthGuard with valid token
- [ ] Test @Public() bypasses auth
- [ ] Test @CurrentUser() extracts user
- [ ] Test @CurrentUser('email') extracts property
- [ ] Test RolesGuard blocks unauthorized
- [ ] Test RolesGuard allows authorized
- [ ] Test PermissionsGuard stub (allows all)
- [ ] Test guard combination order

---

## 📞 Support

**Questions**: Backend Team  
**Bugs**: GitHub Issues  
**Docs**: PR to `documents/`

---

**Version**: 1.0  
**Last Updated**: 2025-01-XX  
**Phase**: 1 (RBAC coming in Phase 2)
