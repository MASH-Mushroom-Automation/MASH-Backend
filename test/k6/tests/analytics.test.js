/**
 * Analytics API Load Test
 * 
 * Tests expensive analytics endpoints:
 * - GET /analytics/dashboard
 * - GET /analytics/revenue
 * - GET /analytics/top-products
 * - GET /analytics/top-categories
 * - GET /analytics/user-engagement
 * 
 * These are the most expensive operations (marked as EXPENSIVE endpoints)
 * Target: P95 < 500ms for analytics (more lenient than standard < 200ms)
 */

import http from 'k6/http';
import { check, group } from 'k6';
import { 
  BASE_URL, 
  customMetrics,
  authenticate,
  getAuthHeaders,
  generateDateRange,
  trackCachePerformance,
  validateResponse,
  thinkTime,
  handleErrors,
} from '../utils/helpers.js';

export function setup() {
  console.log('Setting up Analytics API test...');
  const token = authenticate();
  if (!token) throw new Error('Authentication failed');
  return { token };
}

export default function(data) {
  const headers = getAuthHeaders(data.token);
  const { startDate, endDate } = generateDateRange();
  
  group('Analytics API - Dashboard Stats', () => {
    const response = http.get(
      `${BASE_URL}/analytics/dashboard?startDate=${startDate}&endDate=${endDate}`,
      { headers, tags: { name: 'analytics_dashboard' } }
    );
    
    validateResponse(response, { hasData: true });
    trackCachePerformance(response);
    handleErrors(response, 'analytics_dashboard');
    
    check(response, {
      'dashboard: returns 200': (r) => r.status === 200,
      'dashboard: has stats': (r) => r.json() !== undefined,
      'dashboard: completes in time': (r) => r.timings.duration < 1000,
    });
    
    thinkTime(2, 4);
  });
  
  group('Analytics API - Revenue Reports', () => {
    const response = http.get(
      `${BASE_URL}/analytics/revenue?startDate=${startDate}&endDate=${endDate}&groupBy=day`,
      { headers, tags: { name: 'analytics_revenue' } }
    );
    
    validateResponse(response, { hasData: true });
    trackCachePerformance(response);
    handleErrors(response, 'analytics_revenue');
    
    check(response, {
      'revenue: returns 200': (r) => r.status === 200,
      'revenue: has data': (r) => Array.isArray(r.json('data')),
    });
    
    thinkTime(2, 3);
  });
  
  group('Analytics API - Top Products', () => {
    const response = http.get(
      `${BASE_URL}/analytics/top-products?startDate=${startDate}&endDate=${endDate}&limit=10`,
      { headers, tags: { name: 'analytics_top_products' } }
    );
    
    validateResponse(response, { hasData: true });
    trackCachePerformance(response);
    handleErrors(response, 'analytics_top_products');
    
    check(response, {
      'top products: returns 200': (r) => r.status === 200,
      'top products: has items': (r) => Array.isArray(r.json('data')),
    });
    
    thinkTime(1, 2);
  });
  
  group('Analytics API - Top Categories', () => {
    const response = http.get(
      `${BASE_URL}/analytics/top-categories?startDate=${startDate}&endDate=${endDate}&limit=5`,
      { headers, tags: { name: 'analytics_top_categories' } }
    );
    
    validateResponse(response, { hasData: true });
    trackCachePerformance(response);
    
    thinkTime(1, 2);
  });
  
  group('Analytics API - User Engagement', () => {
    const response = http.get(
      `${BASE_URL}/analytics/user-engagement?startDate=${startDate}&endDate=${endDate}`,
      { headers, tags: { name: 'analytics_engagement' } }
    );
    
    validateResponse(response, { hasData: true });
    trackCachePerformance(response);
    
    thinkTime(2, 3);
  });
  
  thinkTime(3, 6); // Longer think time for analytics (users analyze data)
}

export function teardown(data) {
  console.log('Analytics API test completed');
}
