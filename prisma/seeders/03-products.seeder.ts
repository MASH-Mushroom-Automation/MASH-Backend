import { PrismaClient, Category } from '@prisma/client';

/**
 * Seed Products
 * Creates 50 mushroom products with varied pricing and inventory
 */
export async function seedProducts(prisma: PrismaClient, categories: Category[]) {
  const mushroomNames = [
    'Oyster Mushroom', 'Shiitake', "Lion's Mane", 'Reishi', 'King Oyster',
    'Enoki', 'Maitake', 'Cordyceps', 'Turkey Tail', 'Chaga',
    'Portobello', 'Cremini', 'Button', 'Chanterelle', 'Morel',
  ];

  const adjectives = ['Premium', 'Organic', 'Fresh', 'Dried', 'Wild', 'Cultivated', 'Grade A'];
  const sizes = ['Small', 'Medium', 'Large', 'Extra Large'];
  const packages = ['250g', '500g', '1kg', '2kg', '5kg'];

  const products: any[] = [];

  for (let i = 0; i < 50; i++) {
    const mushroomType = mushroomNames[i % mushroomNames.length];
    const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
    const size = sizes[Math.floor(Math.random() * sizes.length)];
    const packageSize = packages[Math.floor(Math.random() * packages.length)];
    
    const name = `${adjective} ${mushroomType} - ${packageSize}`;
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    
    // Price based on type and size
    const basePrice = 50 + Math.random() * 450; // PHP 50-500
    const price = Math.round(basePrice * 100) / 100;
    const comparePrice = Math.round(price * 1.2 * 100) / 100; // 20% higher
    const costPrice = Math.round(price * 0.6 * 100) / 100; // 40% margin

    const stock = Math.floor(Math.random() * 200) + 10;
    const isFeatured = Math.random() > 0.8; // 20% featured
    
    // Randomly assign 1-3 categories
    const productCategories = categories
      .sort(() => 0.5 - Math.random())
      .slice(0, Math.floor(Math.random() * 3) + 1)
      .map(cat => cat.id);

    const product = await prisma.product.create({
      data: {
        name,
        description: `${adjective} ${mushroomType} harvested fresh from our automated mushroom chambers. ${packageSize} package. Rich in nutrients and perfect for ${Math.random() > 0.5 ? 'cooking' : 'medicinal use'}.`,
        slug: `${slug}-${i}`,
        sku: `MUSH-${String(1000 + i).padStart(4, '0')}`,
        price,
        comparePrice,
        costPrice,
        stock,
        minStock: 5,
        weight: parseFloat(packageSize.replace(/[^0-9.]/g, '')) || 0.25,
        dimensions: {
          length: 20 + Math.random() * 10,
          width: 15 + Math.random() * 10,
          height: 5 + Math.random() * 10,
        },
        images: [
          `https://images.unsplash.com/photo-${1500000000000 + Math.floor(Math.random() * 100000000)}?w=800`,
          `https://images.unsplash.com/photo-${1500000000000 + Math.floor(Math.random() * 100000000)}?w=800`,
          `https://images.unsplash.com/photo-${1500000000000 + Math.floor(Math.random() * 100000000)}?w=800`,
        ],
        categories: productCategories,
        tags: [
          mushroomType.toLowerCase(),
          adjective.toLowerCase(),
          Math.random() > 0.5 ? 'fresh' : 'dried',
          Math.random() > 0.7 ? 'organic' : 'cultivated',
        ],
        attributes: {
          origin: ['Philippines', 'Local Farm', 'Imported from Japan'][Math.floor(Math.random() * 3)],
          shelfLife: `${Math.floor(Math.random() * 10) + 5} days`,
          storage: 'Keep refrigerated at 2-4°C',
          certification: Math.random() > 0.5 ? 'Organic Certified' : 'GAP Certified',
        },
        isActive: true,
        isFeatured,
        seoTitle: `Buy ${name} - Fresh Mushrooms Online | MASH`,
        seoDescription: `Order ${name} online. Premium quality mushrooms delivered fresh. ${packageSize} package. Shop now at MASH Mushroom Automation!`,
      },
    });

    products.push(product);
  }

  return products;
}
