import { PrismaClient, UserRole } from '@prisma/client';

/**
 * Seed Users
 * Creates 20 test users with different roles
 */
export async function seedUsers(prisma: PrismaClient) {
  const users = [
    // Super Admins (3)
    {
      clerkId: 'clerk_superadmin_1',
      email: 'superadmin@mash.com',
      username: 'superadmin',
      firstName: 'Super',
      lastName: 'Admin',
      imageUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=superadmin',
      phoneNumber: '+63 917 123 4567',
      role: UserRole.SUPER_ADMIN,
      isActive: true,
      lastLoginAt: new Date(),
    },
    {
      clerkId: 'clerk_superadmin_2',
      email: 'kenneth.admin@mash.com',
      username: 'kenneth_admin',
      firstName: 'Kenneth',
      lastName: 'Namias',
      imageUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=kenneth',
      phoneNumber: '+63 917 234 5678',
      role: UserRole.SUPER_ADMIN,
      isActive: true,
      lastLoginAt: new Date(),
    },
    {
      clerkId: 'clerk_superadmin_3',
      email: 'system.admin@mash.com',
      username: 'system_admin',
      firstName: 'System',
      lastName: 'Administrator',
      imageUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=system',
      phoneNumber: '+63 917 345 6789',
      role: UserRole.SUPER_ADMIN,
      isActive: true,
    },

    // Admins (2)
    {
      clerkId: 'clerk_admin_1',
      email: 'admin@mash.com',
      username: 'admin1',
      firstName: 'Maria',
      lastName: 'Santos',
      imageUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=maria',
      phoneNumber: '+63 918 123 4567',
      role: UserRole.ADMIN,
      isActive: true,
      lastLoginAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
    },
    {
      clerkId: 'clerk_admin_2',
      email: 'support@mash.com',
      username: 'support_admin',
      firstName: 'Juan',
      lastName: 'Dela Cruz',
      imageUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=juan',
      phoneNumber: '+63 918 234 5678',
      role: UserRole.ADMIN,
      isActive: true,
      lastLoginAt: new Date(Date.now() - 5 * 60 * 60 * 1000), // 5 hours ago
    },

    // Growers (10)
    ...Array.from({ length: 10 }, (_, i) => ({
      clerkId: `clerk_grower_${i + 1}`,
      email: `grower${i + 1}@mash.com`,
      username: `grower_${i + 1}`,
      firstName: ['Pedro', 'Jose', 'Miguel', 'Carlos', 'Luis', 'Antonio', 'Roberto', 'Fernando', 'Manuel', 'Ricardo'][i],
      lastName: ['Garcia', 'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Perez', 'Sanchez', 'Ramirez', 'Torres'][i],
      imageUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=grower${i + 1}`,
      phoneNumber: `+63 919 ${String(100000 + i).slice(0, 3)} ${String(100000 + i).slice(3)}`,
      role: UserRole.GROWER,
      isActive: true,
      lastLoginAt: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000), // Random within last 7 days
    })),

    // Buyers (5)
    ...Array.from({ length: 5 }, (_, i) => ({
      clerkId: `clerk_buyer_${i + 1}`,
      email: `buyer${i + 1}@example.com`,
      username: `buyer_${i + 1}`,
      firstName: ['Ana', 'Sofia', 'Isabella', 'Camila', 'Valentina'][i],
      lastName: ['Cruz', 'Reyes', 'Flores', 'Rivera', 'Morales'][i],
      imageUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=buyer${i + 1}`,
      phoneNumber: `+63 920 ${String(100000 + i).slice(0, 3)} ${String(100000 + i).slice(3)}`,
      role: UserRole.BUYER,
      isActive: true,
      lastLoginAt: new Date(Date.now() - Math.random() * 14 * 24 * 60 * 60 * 1000), // Random within last 14 days
    })),
  ];

  const createdUsers: any[] = [];
  
  for (const userData of users) {
    const user = await prisma.user.create({
      data: {
        ...userData,
        addresses: {
          create: [
            {
              type: 'home',
              firstName: userData.firstName,
              lastName: userData.lastName,
              street1: `${Math.floor(Math.random() * 999) + 1} ${['Mabini', 'Rizal', 'Bonifacio', 'Aguinaldo', 'Luna'][Math.floor(Math.random() * 5)]} St.`,
              city: ['Manila', 'Quezon City', 'Makati', 'Pasig', 'Taguig'][Math.floor(Math.random() * 5)],
              state: 'Metro Manila',
              postalCode: String(1000 + Math.floor(Math.random() * 900)),
              country: 'Philippines',
              phoneNumber: userData.phoneNumber,
              isDefault: true,
            },
          ],
        },
        notifications: {
          create: [
            {
              type: 'INFO',
              title: 'Welcome to MASH!',
              message: `Welcome ${userData.firstName}! Your account has been created successfully.`,
              data: { category: 'onboarding' },
              isRead: false,
            },
          ],
        },
      },
    });

    createdUsers.push(user);
  }

  return createdUsers;
}
