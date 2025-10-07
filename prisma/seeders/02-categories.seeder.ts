import { PrismaClient } from '@prisma/client';

/**
 * Seed Categories
 * Creates 10 hierarchical categories for mushroom products
 */
export async function seedCategories(prisma: PrismaClient) {
  // Create parent categories first
  const parentCategories = [
    {
      name: 'Edible Mushrooms',
      description: 'High-quality edible mushroom varieties for culinary use',
      slug: 'edible-mushrooms',
      imageUrl: 'https://images.unsplash.com/photo-1504192010706-dd7f569ee2be?w=400',
      sortOrder: 1,
    },
    {
      name: 'Medicinal Mushrooms',
      description: 'Mushrooms with health benefits and medicinal properties',
      slug: 'medicinal-mushrooms',
      imageUrl: 'https://images.unsplash.com/photo-1527150122806-f682d2fd8b09?w=400',
      sortOrder: 2,
    },
    {
      name: 'Gourmet Varieties',
      description: 'Premium gourmet mushroom species',
      slug: 'gourmet-varieties',
      imageUrl: 'https://images.unsplash.com/photo-1478145787956-f6f12c59624d?w=400',
      sortOrder: 3,
    },
    {
      name: 'Growing Supplies',
      description: 'Mushroom cultivation equipment and supplies',
      slug: 'growing-supplies',
      imageUrl: 'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=400',
      sortOrder: 4,
    },
  ];

  const createdParents: any[] = [];
  for (const category of parentCategories) {
    const created = await prisma.category.create({ data: category });
    createdParents.push(created);
  }

  // Create subcategories
  const subcategories = [
    // Edible Mushrooms subcategories
    {
      name: 'Oyster Mushrooms',
      description: 'Fresh oyster mushrooms in various colors',
      slug: 'oyster-mushrooms',
      parentId: createdParents[0].id,
      imageUrl: 'https://images.unsplash.com/photo-1527150122806-f682d2fd8b09?w=400',
      sortOrder: 1,
    },
    {
      name: 'Shiitake',
      description: 'Traditional Japanese shiitake mushrooms',
      slug: 'shiitake',
      parentId: createdParents[0].id,
      imageUrl: 'https://images.unsplash.com/photo-1594756202469-9ff9799b2e4e?w=400',
      sortOrder: 2,
    },
    // Medicinal Mushrooms subcategories
    {
      name: 'Reishi',
      description: 'Reishi mushrooms for wellness and immunity',
      slug: 'reishi',
      parentId: createdParents[1].id,
      imageUrl: 'https://images.unsplash.com/photo-1618500092827-c780865e97d2?w=400',
      sortOrder: 1,
    },
    {
      name: "Lion's Mane",
      description: "Lion's mane mushrooms for cognitive health",
      slug: 'lions-mane',
      parentId: createdParents[1].id,
      imageUrl: 'https://images.unsplash.com/photo-1617627143750-d86bc21e42bb?w=400',
      sortOrder: 2,
    },
    // Gourmet Varieties subcategories
    {
      name: 'King Oyster',
      description: 'Large, meaty king oyster mushrooms',
      slug: 'king-oyster',
      parentId: createdParents[2].id,
      imageUrl: 'https://images.unsplash.com/photo-1622656838170-c0e0d6e7e6c7?w=400',
      sortOrder: 1,
    },
    {
      name: 'Enoki',
      description: 'Delicate enoki mushrooms for soups and stir-fries',
      slug: 'enoki',
      parentId: createdParents[2].id,
      imageUrl: 'https://images.unsplash.com/photo-1615485290382-441e4d049cb5?w=400',
      sortOrder: 2,
    },
  ];

  const createdChildren: any[] = [];
  for (const category of subcategories) {
    const created = await prisma.category.create({ data: category });
    createdChildren.push(created);
  }

  return [...createdParents, ...createdChildren];
}
