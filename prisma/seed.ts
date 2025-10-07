import { PrismaClient } from '@prisma/client';
import { seedUsers } from './seeders/01-users.seeder';
import { seedCategories } from './seeders/02-categories.seeder';
import { seedProducts } from './seeders/03-products.seeder';
import { seedDevices } from './seeders/04-devices.seeder';
import { seedSensors } from './seeders/05-sensors.seeder';
import { seedSensorData } from './seeders/06-sensor-data.seeder';
import { seedOrders } from './seeders/07-orders.seeder';
import { seedSystemConfig } from './seeders/08-system-config.seeder';

const prisma = new PrismaClient();

/**
 * Main seeding orchestrator
 * Executes all seeders in the correct order to maintain relationships
 */
async function main() {
  console.log('🌱 Starting database seeding...\n');

  try {
    // Clear existing data (optional - comment out if you want to keep existing data)
    console.log('🗑️  Cleaning existing data...');
    await prisma.auditLog.deleteMany({});
    await prisma.notification.deleteMany({});
    await prisma.payment.deleteMany({});
    await prisma.orderItem.deleteMany({});
    await prisma.order.deleteMany({});
    await prisma.address.deleteMany({});
    await prisma.alert.deleteMany({});
    await prisma.deviceCommand.deleteMany({});
    await prisma.sensorData.deleteMany({});
    await prisma.sensor.deleteMany({});
    await prisma.device.deleteMany({});
    await prisma.product.deleteMany({});
    await prisma.category.deleteMany({});
    await prisma.systemConfig.deleteMany({});
    await prisma.user.deleteMany({});
    console.log('✅ Existing data cleaned\n');

    // Seed in order (maintaining relationships)
    console.log('👥 Seeding users...');
    const users = await seedUsers(prisma);
    console.log(`✅ Created ${users.length} users\n`);

    console.log('🏷️  Seeding categories...');
    const categories = await seedCategories(prisma);
    console.log(`✅ Created ${categories.length} categories\n`);

    console.log('📦 Seeding products...');
    const products = await seedProducts(prisma, categories);
    console.log(`✅ Created ${products.length} products\n`);

    console.log('📱 Seeding devices...');
    const devices = await seedDevices(prisma, users);
    console.log(`✅ Created ${devices.length} devices\n`);

    console.log('🌡️  Seeding sensors...');
    const sensors = await seedSensors(prisma, devices);
    console.log(`✅ Created ${sensors.length} sensors\n`);

    console.log('📊 Seeding sensor data (this may take a moment)...');
    const sensorDataCount = await seedSensorData(prisma, devices, sensors, users);
    console.log(`✅ Created ${sensorDataCount} sensor readings\n`);

    console.log('🛒 Seeding orders...');
    const orders = await seedOrders(prisma, users, products);
    console.log(`✅ Created ${orders.length} orders\n`);

    console.log('⚙️  Seeding system configuration...');
    const configs = await seedSystemConfig(prisma);
    console.log(`✅ Created ${configs.length} system configs\n`);

    // Summary
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🎉 Database seeding completed successfully!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`
📊 Summary:
   👥 Users:           ${users.length}
   🏷️  Categories:      ${categories.length}
   📦 Products:         ${products.length}
   📱 Devices:          ${devices.length}
   🌡️  Sensors:          ${sensors.length}
   📊 Sensor Readings:  ${sensorDataCount}
   🛒 Orders:           ${orders.length}
   ⚙️  System Configs:   ${configs.length}
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   📈 Total Records:    ${users.length + categories.length + products.length + devices.length + sensors.length + sensorDataCount + orders.length + configs.length}
    `);

    console.log('\n🔐 Test User Credentials:');
    console.log('   Super Admin: superadmin@mash.com (clerkId: clerk_superadmin_1)');
    console.log('   Admin:       admin@mash.com (clerkId: clerk_admin_1)');
    console.log('   Grower:      grower1@mash.com (clerkId: clerk_grower_1)');
    console.log('   Buyer:       buyer1@mash.com (clerkId: clerk_buyer_1)');
    console.log('\n💡 Use Prisma Studio to view data: npx prisma studio');
  } catch (error) {
    console.error('❌ Error during seeding:', error);
    throw error;
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
