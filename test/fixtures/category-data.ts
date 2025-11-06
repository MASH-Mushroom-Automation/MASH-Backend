/**
 * ============================================================================
 * TEST FIXTURES - Categories
 * ============================================================================
 * 
 * Reusable test data for category management endpoints
 * ============================================================================
 */

export const categoryFixtures = {
  // Parent categories
  electronics: {
    name: 'Electronics',
    description: 'Electronic devices and accessories',
    slug: 'electronics',
    isActive: true,
  },

  clothing: {
    name: 'Clothing',
    description: 'Apparel and fashion items',
    slug: 'clothing',
    isActive: true,
  },

  food: {
    name: 'Food & Beverages',
    description: 'Fresh produce and packaged foods',
    slug: 'food-beverages',
    isActive: true,
  },

  // Child categories for Electronics
  smartphones: {
    name: 'Smartphones',
    description: 'Mobile phones and accessories',
    slug: 'smartphones',
    isActive: true,
  },

  laptops: {
    name: 'Laptops',
    description: 'Portable computers',
    slug: 'laptops',
    isActive: true,
  },

  tablets: {
    name: 'Tablets',
    description: 'Tablet devices',
    slug: 'tablets',
    isActive: true,
  },

  // Child categories for Clothing
  menClothing: {
    name: "Men's Clothing",
    description: 'Fashion for men',
    slug: 'men-clothing',
    isActive: true,
  },

  womenClothing: {
    name: "Women's Clothing",
    description: 'Fashion for women',
    slug: 'women-clothing',
    isActive: true,
  },

  // Invalid data for testing
  invalidCategory: {
    // Missing required fields
    description: 'Invalid category without name',
  },

  duplicateSlug: {
    name: 'Duplicate Electronics',
    slug: 'electronics', // Same as parent
    description: 'This should fail due to duplicate slug',
  },

  invalidParent: {
    name: 'Invalid Parent Category',
    slug: 'invalid-parent',
    parentId: 'non-existent-parent-id',
  },

  // Update data
  updateCategory: {
    name: 'Electronics Updated',
    description: 'Updated description for electronics',
  },

  deactivateCategory: {
    isActive: false,
  },

  activateCategory: {
    isActive: true,
  },
};

/**
 * Generate test category data
 */
export function generateTestCategory(prefix: string = 'test') {
  const timestamp = Date.now();
  return {
    name: `${prefix} Category ${timestamp}`,
    slug: `${prefix}-category-${timestamp}`,
    description: `Test category created at ${new Date().toISOString()}`,
    isActive: true,
  };
}

/**
 * Generate child category
 */
export function generateChildCategory(parentId: string, prefix: string = 'child') {
  const timestamp = Date.now();
  return {
    name: `${prefix} Subcategory ${timestamp}`,
    slug: `${prefix}-subcategory-${timestamp}`,
    description: `Child category under parent ${parentId}`,
    parentId,
    isActive: true,
  };
}

/**
 * Generate category tree
 */
export function generateCategoryTree() {
  return {
    parent: {
      name: 'Test Parent Category',
      slug: 'test-parent-category',
      description: 'Parent category for testing tree structure',
      isActive: true,
    },
    children: [
      {
        name: 'Test Child 1',
        slug: 'test-child-1',
        description: 'First child category',
        isActive: true,
      },
      {
        name: 'Test Child 2',
        slug: 'test-child-2',
        description: 'Second child category',
        isActive: true,
      },
      {
        name: 'Test Child 3',
        slug: 'test-child-3',
        description: 'Third child category',
        isActive: false, // Inactive child
      },
    ],
  };
}

/**
 * Generate random category name
 */
export function generateRandomCategoryName(): string {
  const adjectives = ['Premium', 'Essential', 'Luxury', 'Budget', 'Eco-Friendly'];
  const nouns = ['Gadgets', 'Accessories', 'Equipment', 'Supplies', 'Tools'];
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  return `${adj} ${noun}`;
}

/**
 * Generate slug from name
 */
export function generateSlugFromName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}
