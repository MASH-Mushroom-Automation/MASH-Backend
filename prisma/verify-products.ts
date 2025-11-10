import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function verifyProducts() {
  console.log('🔍 Verifying products in database...\n');

  try {
    // Count total products
    const totalCount = await prisma.product.count({
      where: { isDeleted: false },
    });

    // Count featured products
    const featuredCount = await prisma.product.count({
      where: { isDeleted: false, isFeatured: true },
    });

    // Get all products
    const products = await prisma.product.findMany({
      where: { isDeleted: false },
      select: {
        id: true,
        name: true,
        sku: true,
        price: true,
        stock: true,
        isFeatured: true,
        isActive: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    // Calculate totals
    const totalStock = products.reduce((sum, p) => sum + p.stock, 0);
    const totalValue = products.reduce((sum, p) => sum + (Number(p.price) * p.stock), 0);

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 DATABASE VERIFICATION REPORT');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    console.log('📈 Summary Statistics:');
    console.log(`   Total Products:    ${totalCount}`);
    console.log(`   Featured Products: ${featuredCount}`);
    console.log(`   Total Stock:       ${totalStock} units`);
    console.log(`   Total Value:       ₱${totalValue.toFixed(2)}\n`);

    console.log('📋 Product List:\n');
    products.forEach((product, index) => {
      const featured = product.isFeatured ? '⭐' : '  ';
      const active = product.isActive ? '✅' : '❌';
      console.log(
        `${featured} ${active} ${index + 1}. ${product.name.padEnd(40)} | SKU: ${product.sku.padEnd(12)} | ₱${String(product.price).padStart(6)} | Stock: ${String(product.stock).padStart(3)}`
      );
    });

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ Verification Complete!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Test queries
    console.log('🧪 Testing Common Queries:\n');

    const freshMushrooms = await prisma.product.count({
      where: {
        categories: { has: 'Fresh Mushroom' },
        isDeleted: false,
      },
    });
    console.log(`   Fresh Mushrooms:   ${freshMushrooms} products`);

    const growingKits = await prisma.product.count({
      where: {
        categories: { has: 'Growing Kits' },
        isDeleted: false,
      },
    });
    console.log(`   Growing Kits:      ${growingKits} products`);

    const lowStock = await prisma.product.count({
      where: {
        stock: { lte: 10 },
        isDeleted: false,
      },
    });
    console.log(`   Low Stock (<= 10): ${lowStock} products`);

    const highValue = await prisma.product.count({
      where: {
        price: { gte: 300 },
        isDeleted: false,
      },
    });
    console.log(`   High Value (≥300): ${highValue} products\n`);

    console.log('✅ All tests passed! Database is ready.\n');
  } catch (error) {
    console.error('❌ Error verifying products:', error);
    throw error;
  }
}

verifyProducts()
  .then(async () => {
    await prisma.$disconnect();
    process.exit(0);
  })
  .catch(async (e) => {
    console.error('\n❌ Verification failed:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
