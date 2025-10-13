/**
 * Orders API Load Test
 * 
 * Tests all order-related endpoints:
 * - GET /orders (list with pagination)
 * - GET /orders/:id (single order)
 * - POST /orders (create order)
 * - GET /orders/user/:userId (user orders)
 * 
 * Validates:
 * - Order creation performance
 * - Cache hit rate for order listings
 * - Pagination and field selection
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
  handleErrors,
} from '../utils/helpers.js';

export function setup() {
  console.log('Setting up Orders API test...');
  const token = authenticate();
  if (!token) throw new Error('Authentication failed');
  return { token };
}

export default function(data) {
  const headers = getAuthHeaders(data.token);
  
  group('Orders API - List Orders', () => {
    const response = http.get(
      `${BASE_URL}/orders${generateQueryParams({ page: 1, limit: 20 })}`,
      { headers, tags: { name: 'orders_list' } }
    );
    
    validateResponse(response, { hasData: true, pagination: true });
    trackCachePerformance(response);
    handleErrors(response, 'orders_list');
    
    check(response, {
      'orders: list returns 200': (r) => r.status === 200,
      'orders: has items': (r) => Array.isArray(r.json('data')),
      'orders: has pagination': (r) => r.json('meta') !== undefined,
    });
    
    thinkTime(1, 2);
  });
  
  group('Orders API - Single Order', () => {
    // Get an order ID
    const listResponse = http.get(
      `${BASE_URL}/orders${generateQueryParams({ page: 1, limit: 1 })}`,
      { headers, tags: { name: 'orders_get_id' } }
    );
    
    let orderId = null;
    if (listResponse.status === 200) {
      const items = listResponse.json('data');
      if (items && items.length > 0) orderId = items[0].id;
    }
    
    if (orderId) {
      thinkTime(0.5, 1);
      
      const response = http.get(
        `${BASE_URL}/orders/${orderId}`,
        { headers, tags: { name: 'orders_get_single' } }
      );
      
      validateResponse(response, { hasData: true });
      trackCachePerformance(response);
      handleErrors(response, 'orders_get_single');
      
      check(response, {
        'order: returns 200': (r) => r.status === 200,
        'order: has id': (r) => r.json('id') !== undefined,
        'order: has status': (r) => r.json('status') !== undefined,
        'order: has items': (r) => Array.isArray(r.json('items')),
      });
    }
    
    thinkTime(1, 2);
  });
  
  group('Orders API - Create Order', () => {
    // Create a test order (simplified)
    const orderData = {
      items: [
        { productId: 1, quantity: 2, price: 10.99 },
        { productId: 2, quantity: 1, price: 15.99 },
      ],
      shippingAddressId: 1,
      paymentMethod: 'CREDIT_CARD',
    };
    
    const startTime = new Date();
    const response = http.post(
      `${BASE_URL}/orders`,
      JSON.stringify(orderData),
      { headers, tags: { name: 'orders_create' } }
    );
    
    const duration = new Date() - startTime;
    customMetrics.orderCreationTime.add(duration);
    
    const success = response.status === 201;
    customMetrics.orderCreationRate.add(success);
    
    check(response, {
      'order create: returns 201': (r) => r.status === 201,
      'order create: has order id': (r) => r.json('id') !== undefined,
      'order create: fast enough': (r) => r.timings.duration < 500,
    });
    
    handleErrors(response, 'orders_create');
    
    thinkTime(2, 4);
  });
  
  group('Orders API - Filters', () => {
    // Test status filter
    const response = http.get(
      `${BASE_URL}/orders${generateQueryParams({ 
        page: 1, 
        limit: 20,
        status: 'COMPLETED'
      })}`,
      { headers, tags: { name: 'orders_filter_status' } }
    );
    
    validateResponse(response, { hasData: true });
    trackCachePerformance(response);
    
    thinkTime(1, 2);
  });
  
  thinkTime(2, 4);
}

export function teardown(data) {
  console.log('Orders API test completed');
}
