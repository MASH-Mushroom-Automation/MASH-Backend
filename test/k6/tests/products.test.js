/**
 * Products API Load Test
 * 
 * Tests all product-related endpoints:
 * - GET /products (list with pagination, sorting, filtering)
 * - GET /products/:id (single product)
 * - GET /products/search (search functionality)
 * - GET /categories (product categories)
 * 
 * Validates:
 * - Response times < 200ms P95
 * - Cache hit rate > 80%
 * - Field selection reduces response size
 * - Pagination works correctly
 */

import http from 'k6/http';
import { check, group } from 'k6';
import { 
  BASE_URL, 
  customMetrics,
  authenticate,
  getAuthHeaders,
  generateQueryParams,
  trackCachePerformance,
  validateResponse,
  thinkTime,
  getRandomSearchTerm,
  handleErrors,
} from '../utils/helpers.js';

// Test setup
export function setup() {
  console.log('Setting up Products API test...');
  const token = authenticate();
  
  if (!token) {
    throw new Error('Authentication failed during setup');
  }
  
  return { token };
}

// Main test function
export default function(data) {
  const headers = getAuthHeaders(data.token);
  
  group('Products API - List Products', () => {
    // Test 1: Basic list (should hit cache)
    const response1 = http.get(
      `${BASE_URL}/products${generateQueryParams({ page: 1, limit: 20 })}`,
      { headers, tags: { name: 'products_list_basic' } }
    );
    
    const valid1 = validateResponse(response1, { hasData: true, pagination: true });
    trackCachePerformance(response1);
    handleErrors(response1, 'products_list_basic');
    
    check(response1, {
      'products: list returns 200': (r) => r.status === 200,
      'products: has items array': (r) => Array.isArray(r.json('data')),
      'products: has pagination meta': (r) => r.json('meta') !== undefined,
      'products: total count exists': (r) => r.json('meta.total') >= 0,
    });
    
    thinkTime(0.5, 1.5);
    
    // Test 2: With sorting
    const response2 = http.get(
      `${BASE_URL}/products${generateQueryParams({ 
        page: 1, 
        limit: 20, 
        sortBy: 'price', 
        sortOrder: 'asc' 
      })}`,
      { headers, tags: { name: 'products_list_sorted' } }
    );
    
    validateResponse(response2, { hasData: true });
    trackCachePerformance(response2);
    handleErrors(response2, 'products_list_sorted');
    
    thinkTime(0.5, 1.5);
    
    // Test 3: With field selection (should reduce response size)
    const fieldsToSelect = 'id,name,price,stockQuantity';
    const response3 = http.get(
      `${BASE_URL}/products${generateQueryParams({ 
        page: 1, 
        limit: 20, 
        fields: fieldsToSelect 
      })}`,
      { headers, tags: { name: 'products_list_fields' } }
    );
    
    validateResponse(response3, { hasData: true });
    trackCachePerformance(response3);
    
    // Check field selection worked
    const fieldSelectionWorked = check(response3, {
      'products: field selection active': (r) => {
        try {
          const items = r.json('data');
          if (!items || items.length === 0) return false;
          
          const firstItem = items[0];
          const selectedFields = fieldsToSelect.split(',');
          const itemKeys = Object.keys(firstItem);
          
          // Check that only selected fields exist (plus maybe id)
          return itemKeys.every(key => selectedFields.includes(key) || key === 'id');
        } catch (e) {
          return false;
        }
      },
    });
    
    customMetrics.fieldSelectionRate.add(fieldSelectionWorked);
    
    // Compare response sizes
    if (response1.body && response3.body) {
      const sizeDiff = response1.body.length - response3.body.length;
      customMetrics.fieldSelectionSavings.add(sizeDiff);
    }
  });
  
  group('Products API - Single Product', () => {
    // Get a product ID from the list
    const listResponse = http.get(
      `${BASE_URL}/products${generateQueryParams({ page: 1, limit: 1 })}`,
      { headers, tags: { name: 'products_get_id' } }
    );
    
    let productId = null;
    if (listResponse.status === 200) {
      const items = listResponse.json('data');
      if (items && items.length > 0) {
        productId = items[0].id;
      }
    }
    
    if (productId) {
      thinkTime(0.5, 1);
      
      // Test 4: Get single product
      const response4 = http.get(
        `${BASE_URL}/products/${productId}`,
        { headers, tags: { name: 'products_get_single' } }
      );
      
      validateResponse(response4, { hasData: true });
      trackCachePerformance(response4);
      handleErrors(response4, 'products_get_single');
      
      check(response4, {
        'product: single returns 200': (r) => r.status === 200,
        'product: has id': (r) => r.json('id') !== undefined,
        'product: has name': (r) => r.json('name') !== undefined,
        'product: has price': (r) => r.json('price') !== undefined,
      });
      
      thinkTime(0.5, 1);
      
      // Test 5: Get with field selection
      const response5 = http.get(
        `${BASE_URL}/products/${productId}?fields=id,name,price`,
        { headers, tags: { name: 'products_get_single_fields' } }
      );
      
      validateResponse(response5, { hasData: true });
      trackCachePerformance(response5);
    }
  });
  
  group('Products API - Search', () => {
    const searchTerm = getRandomSearchTerm();
    
    // Test 6: Product search
    const response6 = http.get(
      `${BASE_URL}/products/search${generateQueryParams({ 
        search: searchTerm,
        page: 1,
        limit: 20
      })}`,
      { headers, tags: { name: 'products_search' } }
    );
    
    validateResponse(response6, { hasData: true });
    trackCachePerformance(response6);
    handleErrors(response6, 'products_search');
    
    check(response6, {
      'search: returns 200': (r) => r.status === 200,
      'search: has results array': (r) => Array.isArray(r.json('data')),
      'search: has meta': (r) => r.json('meta') !== undefined,
    });
    
    // Track search performance
    customMetrics.productSearchTime.add(response6.timings.duration);
    
    thinkTime(1, 2);
  });
  
  group('Products API - Categories', () => {
    // Test 7: List categories (heavily cached)
    const response7 = http.get(
      `${BASE_URL}/categories`,
      { headers, tags: { name: 'categories_list' } }
    );
    
    validateResponse(response7, { hasData: true });
    trackCachePerformance(response7);
    handleErrors(response7, 'categories_list');
    
    check(response7, {
      'categories: returns 200': (r) => r.status === 200,
      'categories: has items': (r) => Array.isArray(r.json('data')) && r.json('data').length > 0,
      'categories: response fast': (r) => r.timings.duration < 100, // Should be very fast (cached)
    });
    
    thinkTime(0.5, 1);
    
    // Test 8: Get category details
    let categoryId = null;
    if (response7.status === 200) {
      const categories = response7.json('data');
      if (categories && categories.length > 0) {
        categoryId = categories[0].id;
      }
    }
    
    if (categoryId) {
      const response8 = http.get(
        `${BASE_URL}/categories/${categoryId}`,
        { headers, tags: { name: 'categories_get_single' } }
      );
      
      validateResponse(response8, { hasData: true });
      trackCachePerformance(response8);
      handleErrors(response8, 'categories_get_single');
      
      check(response8, {
        'category: returns 200': (r) => r.status === 200,
        'category: has id': (r) => r.json('id') !== undefined,
        'category: has name': (r) => r.json('name') !== undefined,
      });
    }
  });
  
  group('Products API - Filters', () => {
    // Test 9: Filter by category
    const response9 = http.get(
      `${BASE_URL}/products${generateQueryParams({ 
        page: 1, 
        limit: 20,
        categoryId: 1 // Assuming category 1 exists
      })}`,
      { headers, tags: { name: 'products_filter_category' } }
    );
    
    validateResponse(response9, { hasData: true });
    trackCachePerformance(response9);
    
    // Test 10: Filter by stock status
    const response10 = http.get(
      `${BASE_URL}/products${generateQueryParams({ 
        page: 1, 
        limit: 20,
        inStock: true
      })}`,
      { headers, tags: { name: 'products_filter_stock' } }
    );
    
    validateResponse(response10, { hasData: true });
    trackCachePerformance(response10);
  });
  
  thinkTime(2, 4); // User think time before next iteration
}

// Test teardown
export function teardown(data) {
  console.log('Products API test completed');
}
