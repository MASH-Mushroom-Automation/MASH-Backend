import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * RBAC Seed Data
 * Creates default permissions, roles, and role-permission mappings
 */

// Define all permissions (resource:action)
const permissions = [
  // User Management
  { resource: 'users', action: 'read', description: 'View user information' },
  { resource: 'users', action: 'create', description: 'Create new users' },
  { resource: 'users', action: 'update', description: 'Update user information' },
  { resource: 'users', action: 'delete', description: 'Delete users' },
  { resource: 'users', action: 'manage_roles', description: 'Manage user roles' },

  // Device Management
  { resource: 'devices', action: 'read', description: 'View devices' },
  { resource: 'devices', action: 'create', description: 'Create devices' },
  { resource: 'devices', action: 'update', description: 'Update devices' },
  { resource: 'devices', action: 'delete', description: 'Delete devices' },
  { resource: 'devices', action: 'control', description: 'Send commands to devices' },

  // Sensor Management
  { resource: 'sensors', action: 'read', description: 'View sensor data' },
  { resource: 'sensors', action: 'create', description: 'Create sensors' },
  { resource: 'sensors', action: 'update', description: 'Update sensors' },
  { resource: 'sensors', action: 'delete', description: 'Delete sensors' },
  { resource: 'sensors', action: 'calibrate', description: 'Calibrate sensors' },

  // Order Management
  { resource: 'orders', action: 'read', description: 'View orders' },
  { resource: 'orders', action: 'create', description: 'Create orders' },
  { resource: 'orders', action: 'update', description: 'Update orders' },
  { resource: 'orders', action: 'delete', description: 'Delete orders' },
  { resource: 'orders', action: 'process', description: 'Process orders' },
  { resource: 'orders', action: 'cancel', description: 'Cancel orders' },

  // Product Management
  { resource: 'products', action: 'read', description: 'View products' },
  { resource: 'products', action: 'create', description: 'Create products' },
  { resource: 'products', action: 'update', description: 'Update products' },
  { resource: 'products', action: 'delete', description: 'Delete products' },
  { resource: 'products', action: 'manage_stock', description: 'Manage product stock' },

  // Category Management
  { resource: 'categories', action: 'read', description: 'View categories' },
  { resource: 'categories', action: 'create', description: 'Create categories' },
  { resource: 'categories', action: 'update', description: 'Update categories' },
  { resource: 'categories', action: 'delete', description: 'Delete categories' },

  // Payment Management
  { resource: 'payments', action: 'read', description: 'View payments' },
  { resource: 'payments', action: 'process', description: 'Process payments' },
  { resource: 'payments', action: 'refund', description: 'Refund payments' },

  // Notification Management
  { resource: 'notifications', action: 'read', description: 'View notifications' },
  { resource: 'notifications', action: 'create', description: 'Create notifications' },
  { resource: 'notifications', action: 'delete', description: 'Delete notifications' },

  // Analytics
  { resource: 'analytics', action: 'read', description: 'View analytics data' },
  { resource: 'analytics', action: 'export', description: 'Export analytics data' },

  // System Administration
  { resource: 'system', action: 'read', description: 'View system configuration' },
  { resource: 'system', action: 'update', description: 'Update system configuration' },
  { resource: 'system', action: 'maintenance', description: 'Perform system maintenance' },
  { resource: 'audit_logs', action: 'read', description: 'View audit logs' },
  { resource: 'security_logs', action: 'read', description: 'View security logs' },

  // API Keys
  { resource: 'api_keys', action: 'read', description: 'View API keys' },
  { resource: 'api_keys', action: 'create', description: 'Create API keys' },
  { resource: 'api_keys', action: 'delete', description: 'Delete API keys' },
];

// Define roles with their permissions
const roles = [
  {
    name: 'SUPER_ADMIN',
    description: 'Full system access with all permissions',
    isSystem: true,
    permissions: permissions.map((p) => `${p.resource}:${p.action}`), // All permissions
  },
  {
    name: 'ADMIN',
    description: 'Administrative access with most permissions',
    isSystem: true,
    permissions: [
      // User Management (limited)
      'users:read',
      'users:update',
      'users:manage_roles',
      // Full Device & Sensor Management
      'devices:read',
      'devices:create',
      'devices:update',
      'devices:delete',
      'devices:control',
      'sensors:read',
      'sensors:create',
      'sensors:update',
      'sensors:delete',
      'sensors:calibrate',
      // Full Order Management
      'orders:read',
      'orders:update',
      'orders:process',
      'orders:cancel',
      // Full Product Management
      'products:read',
      'products:create',
      'products:update',
      'products:delete',
      'products:manage_stock',
      // Category Management
      'categories:read',
      'categories:create',
      'categories:update',
      'categories:delete',
      // Payment Management
      'payments:read',
      'payments:process',
      'payments:refund',
      // Notifications
      'notifications:read',
      'notifications:create',
      'notifications:delete',
      // Analytics
      'analytics:read',
      'analytics:export',
      // System (read-only)
      'system:read',
      'audit_logs:read',
      'security_logs:read',
      // API Keys
      'api_keys:read',
      'api_keys:create',
      'api_keys:delete',
    ],
  },
  {
    name: 'GROWER',
    description: 'Mushroom grower with device and sensor management',
    isSystem: true,
    permissions: [
      // Own devices and sensors
      'devices:read',
      'devices:create',
      'devices:update',
      'devices:control',
      'sensors:read',
      'sensors:create',
      'sensors:update',
      'sensors:calibrate',
      // Products (own products)
      'products:read',
      'products:create',
      'products:update',
      'products:manage_stock',
      // Orders (view own orders)
      'orders:read',
      'orders:update',
      // Notifications
      'notifications:read',
      // Analytics (own data)
      'analytics:read',
    ],
  },
  {
    name: 'BUYER',
    description: 'Customer with order and product access',
    isSystem: true,
    permissions: [
      // Products (read-only)
      'products:read',
      // Categories (read-only)
      'categories:read',
      // Orders (own orders)
      'orders:read',
      'orders:create',
      'orders:cancel',
      // Payments (own payments)
      'payments:read',
      // Notifications
      'notifications:read',
    ],
  },
  {
    name: 'USER',
    description: 'Basic user with minimal permissions',
    isSystem: true,
    permissions: [
      // Basic read access
      'products:read',
      'categories:read',
      'notifications:read',
    ],
  },
];

export async function seedRBAC() {
  console.log('🔐 Seeding RBAC data...');

  try {
    // 1. Create all permissions
    console.log('  📋 Creating permissions...');
    const createdPermissions = new Map<string, string>(); // Map of "resource:action" to permission ID

    for (const permission of permissions) {
      const created = await prisma.permission.upsert({
        where: {
          resource_action: {
            resource: permission.resource,
            action: permission.action,
          },
        },
        update: {
          description: permission.description,
        },
        create: {
          resource: permission.resource,
          action: permission.action,
          description: permission.description,
        },
      });

      createdPermissions.set(`${created.resource}:${created.action}`, created.id);
    }

    console.log(`  ✅ Created/updated ${permissions.length} permissions`);

    // 2. Create roles and assign permissions
    console.log('  👥 Creating roles...');

    for (const roleData of roles) {
      // Create or update role
      const role = await prisma.role.upsert({
        where: { name: roleData.name },
        update: {
          description: roleData.description,
          isSystem: roleData.isSystem,
        },
        create: {
          name: roleData.name,
          description: roleData.description,
          isSystem: roleData.isSystem,
        },
      });

      // Delete existing role permissions to start fresh
      await prisma.rolePermission.deleteMany({
        where: { roleId: role.id },
      });

      // Create role-permission mappings
      const rolePermissionsToCreate = roleData.permissions
        .map((permissionKey) => {
          const permissionId = createdPermissions.get(permissionKey);
          if (!permissionId) {
            console.warn(`    ⚠️  Permission not found: ${permissionKey}`);
            return null;
          }
          return {
            roleId: role.id,
            permissionId: permissionId,
          };
        })
        .filter((rp) => rp !== null);

      if (rolePermissionsToCreate.length > 0) {
        await prisma.rolePermission.createMany({
          data: rolePermissionsToCreate,
          skipDuplicates: true,
        });
      }

      console.log(
        `  ✅ Role "${roleData.name}": ${rolePermissionsToCreate.length} permissions`,
      );
    }

    console.log('✅ RBAC seeding completed successfully!');
    console.log('');
    console.log('📊 Summary:');
    console.log(`  - Permissions: ${permissions.length}`);
    console.log(`  - Roles: ${roles.length}`);
    console.log(`  - SUPER_ADMIN: All ${permissions.length} permissions`);
    console.log(`  - ADMIN: ${roles[1].permissions.length} permissions`);
    console.log(`  - GROWER: ${roles[2].permissions.length} permissions`);
    console.log(`  - BUYER: ${roles[3].permissions.length} permissions`);
    console.log(`  - USER: ${roles[4].permissions.length} permissions`);
  } catch (error) {
    console.error('❌ Error seeding RBAC data:', error);
    throw error;
  }
}

// Run seed if executed directly
if (require.main === module) {
  seedRBAC()
    .catch((error) => {
      console.error(error);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
