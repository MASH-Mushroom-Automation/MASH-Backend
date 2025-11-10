import { PrismaClient, Category } from '@prisma/client';

/**
 * Seed Products
 * Creates real MASH mushroom products with actual product data
 */
export async function seedProducts(prisma: PrismaClient, categories: Category[]) {
  console.log('📦 Starting product seeding with real product data...');

  // Real product data from MASH inventory
  const productsData = [
    {
      name: "Fresh White Oyster Mushrooms",
      slug: "fresh-white-oyster-mushrooms",
      sku: "FWO-250G",
      description: "Delicate, nutty flavor perfect for stir-fries and soups. Harvested daily for maximum freshness.",
      price: 120,
      comparePrice: 150,
      costPrice: 80,
      stock: 45,
      minStock: 10,
      weight: 0.25, // 250g in kg
      images: ["/white.jpg", "/white-2.jpg", "/white-3.jpg", "/white-4.jpg"],
      category: "Fresh Mushroom",
      categories: ["Fresh Mushroom", "Oyster Mushrooms"],
      tags: ["New", "Fresh", "Popular"],
      grower: "FungiFreshFarms",
      growerId: "grower_001",
      isFeatured: true,
    },
    {
      name: "Mushroom Chips",
      slug: "mushroom-chips",
      sku: "MC-100G",
      description: "Beautiful pink caps with a meaty texture—great for sautés and vegan bacon.",
      price: 140,
      comparePrice: null,
      costPrice: null,
      stock: 30,
      minStock: 5,
      weight: 0.25, // 250g in kg
      images: ["/Pink-Oyster-1.webp", "/Pink-Oyster-2.webp", "/Pink-Oyster-3.webp", "/Pink-Oyster-4.webp"],
      category: "Fresh Mushroom",
      categories: ["Fresh Mushroom", "Snacks"],
      tags: ["Chips", "Snack"],
      grower: "FungiFreshFarms",
      growerId: "grower_001",
      isFeatured: false,
    },
    {
      name: "Blue Oyster Mushrooms",
      slug: "blue-oyster-mushrooms",
      sku: "BOY-200G",
      description: "Rich umami notes and dense texture—ideal for broths and roasts.",
      price: 150,
      comparePrice: null,
      costPrice: null,
      stock: 25,
      minStock: 8,
      weight: 0.2, // 200g in kg
      images: ["/blue-oyster-mushrooms.jpg", "/blue-1.webp", "/blue-2.webp", "/blue-3.webp"],
      category: "Fresh Mushroom",
      categories: ["Fresh Mushroom", "Oyster Mushrooms", "Premium"],
      tags: ["Fresh", "Gourmet"],
      grower: "TheMushroomPatchBukidnon",
      growerId: "grower_002",
      isFeatured: true,
    },
    {
      name: "White Oyster Mushroom Growing Kit",
      slug: "white-oyster-mushroom-growing-kit",
      sku: "WOK-2KG",
      description: "Our best-selling oyster mushroom growing kit! Perfect for beginners with complete instructions and guaranteed results.",
      price: 350,
      comparePrice: 400,
      costPrice: null,
      stock: 18,
      minStock: 5,
      weight: 2.0, // 2kg complete growing kit
      images: ["/kit-1.jpg", "/kit-2.webp", "/kit.jpg", "/kit-4.jpg"],
      category: "Growing Kits",
      categories: ["Growing Kits", "Beginner Friendly"],
      tags: ["Popular", "Best Seller", "Beginner Friendly"],
      grower: "KingFarms",
      growerId: "grower_003",
      isFeatured: true,
    },
    {
      name: "Crispy Mushroom Chicharon",
      slug: "crispy-mushroom-chicharon",
      sku: "CMC-100G",
      description: "Crunchy, savory mushroom snack—perfect with dips or as topping.",
      price: 150,
      comparePrice: null,
      costPrice: null,
      stock: 40,
      minStock: 10,
      weight: 0.1, // 100g in kg
      images: ["/chicharon-1.jpg", "/chicharon-2.webp", "/chicharon-3.jpg", "/chicharon-4.jpg"],
      category: "Mushroom Products",
      categories: ["Mushroom Products", "Snacks"],
      tags: ["Snack", "Crispy"],
      grower: "FungiFreshFarms",
      growerId: "grower_001",
      isFeatured: false,
    },
    {
      name: "Bagoong Mushroom",
      slug: "bagoong-mushroom",
      sku: "BM-200G",
      description: "A rich, vegan-friendly twist on classic Filipino bagoong made from savory oyster mushrooms, delivering deep umami flavor without the seafood.",
      price: 380,
      comparePrice: null,
      costPrice: null,
      stock: 12,
      minStock: 3,
      weight: 0.2, // 200g in kg
      images: ["/bagoong.webp", "/bagoong-2.png", "/bagoong-3.png", "/bagoong-4.png"],
      category: "Preserved Foods",
      categories: ["Preserved Foods", "Filipino Products"],
      tags: ["New", "Vegan", "Filipino"],
      grower: "FungiFreshFarms",
      growerId: "grower_001",
      isFeatured: true,
    },
    {
      name: "Blue Oyster Mushroom Growing Kit",
      slug: "blue-oyster-mushroom-growing-kit",
      sku: "BOK-2KG",
      description: "Experience the joy of growing blue oyster mushrooms in your own home! Complete beginner-friendly kit.",
      price: 370,
      comparePrice: null,
      costPrice: null,
      stock: 15,
      minStock: 5,
      weight: 2.0, // 2kg substrate bag
      images: ["/blue-kit1.avif", "/blue-kit2.jpg", "/blue-kit3.avif", "/blue-kit4.jpg"],
      category: "Growing Kits",
      categories: ["Growing Kits", "Beginner Friendly"],
      tags: ["Popular", "Beginner Friendly"],
      grower: "TheMushroomPatchBukidnon",
      growerId: "grower_002",
      isFeatured: true,
    },
    {
      name: "Premium Golden Oyster Growing Kit",
      slug: "premium-golden-oyster-growing-kit",
      sku: "GOK-2KG-PREM",
      description: "Grow beautiful golden oyster mushrooms at home! This premium kit produces stunning clusters of bright yellow oyster mushrooms.",
      price: 450,
      comparePrice: 550,
      costPrice: null,
      stock: 8,
      minStock: 3,
      weight: 2.0, // 2kg substrate bag
      images: ["/gold-kit1.webp", "/gold-kit2.jpg", "/gold-kit3.jpg", "/gold-kit4.jpg"],
      category: "Growing Kits",
      categories: ["Growing Kits", "Premium"],
      tags: ["Premium", "Gourmet"],
      grower: "KingFarms",
      growerId: "grower_003",
      isFeatured: false,
    },
    {
      name: "King Oyster Mushroom Growing Kit",
      slug: "king-oyster-mushroom-growing-kit",
      sku: "KOK-2.5KG",
      description: "Grow delicious king oyster mushrooms at home! Known for their meaty texture and robust flavor, perfect for gourmet cooking.",
      price: 420,
      comparePrice: null,
      costPrice: null,
      stock: 10,
      minStock: 4,
      weight: 2.5, // 2.5kg substrate bag
      images: ["/king-kit1.avif", "/king-kit2.webp", "/king-kit3.jpg", "/king-kit4.avif"],
      category: "Growing Kits",
      categories: ["Growing Kits", "Beginner Friendly", "Gourmet"],
      tags: ["Beginner Friendly", "Gourmet"],
      grower: "FungiFreshFarms",
      growerId: "grower_001",
      isFeatured: false,
    },
  ];

  const products: any[] = [];
  let successCount = 0;
  let errorCount = 0;

  for (const productData of productsData) {
    try {
      console.log(`   Creating: ${productData.name}...`);

      const product = await prisma.product.create({
        data: {
          name: productData.name,
          description: productData.description,
          slug: productData.slug,
          sku: productData.sku,
          price: productData.price,
          comparePrice: productData.comparePrice,
          costPrice: productData.costPrice,
          stock: productData.stock,
          minStock: productData.minStock,
          weight: productData.weight,
          dimensions: {
            length: 20,
            width: 15,
            height: 10,
          },
          images: productData.images,
          categories: productData.categories,
          tags: productData.tags,
          attributes: {
            grower: productData.grower,
            growerId: productData.growerId,
            category: productData.category,
            origin: "Philippines",
            shelfLife: productData.category === "Growing Kits" ? "6 months" : "7-14 days",
            storage: productData.category === "Growing Kits" 
              ? "Store in cool, dry place" 
              : "Keep refrigerated at 2-4°C",
          },
          isActive: true,
          isFeatured: productData.isFeatured,
          isDeleted: false,
          seoTitle: `${productData.name} - Buy Online | MASH Philippines`,
          seoDescription: `${productData.description} Order ${productData.name} online from MASH. Fresh mushrooms and growing kits delivered to your door!`,
        },
      });

      products.push(product);
      successCount++;
      console.log(`   ✅ Created: ${product.name} (SKU: ${product.sku})`);
    } catch (error) {
      errorCount++;
      console.error(`   ❌ Failed to create ${productData.name}:`, error.message);
    }
  }

  console.log(`\n📊 Product Seeding Summary:`);
  console.log(`   ✅ Successfully created: ${successCount} products`);
  console.log(`   ❌ Failed: ${errorCount} products`);
  console.log(`   📦 Total products in database: ${products.length}`);

  return products;
}
