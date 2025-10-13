/**
 * k6 Test Utilities and Helpers
 * 
 * Common functions for all k6 tests
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

/**
 * Base URL Configuration
 * Change this based on environment
 */
export const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

/**
 * Custom Metrics
 */
export const customMetrics = {
  // Cache Performance
  cacheHitRate: new Rate('cache_hit_rate'),
  cacheResponseTime: new Trend('cache_response_time'),
  cacheMissTime: new Trend('cache_miss_time'),
  
  // Authentication
  authSuccessRate: new Rate('auth_success_rate'),
  authDuration: new Trend('auth_duration'),
  
  // Business Metrics
  orderCreationRate: new Rate('order_creation_success'),
  orderCreationTime: new Trend('order_creation_duration'),
  productSearchTime: new Trend('product_search_duration'),
  
  // Field Selection
  fieldSelectionSavings: new Trend('field_selection_bytes_saved'),
  fieldSelectionRate: new Rate('field_selection_used'),
  
  // Pagination
  paginationSuccessRate: new Rate('pagination_success'),
  itemsPerPage: new Trend('pagination_items_per_page'),
  
  // Error Tracking
  authErrors: new Counter('auth_errors'),
  validationErrors: new Counter('validation_errors'),
  serverErrors: new Counter('server_errors'),
  timeoutErrors: new Counter('timeout_errors'),
};

/**
 * Generate random user credentials for load testing
 * Uses pre-seeded test accounts (buyer1-buyer100, grower1-grower50)
 */
export function getRandomTestUser() {
  const userTypes = [
    { prefix: 'buyer', count: 100 },
    { prefix: 'grower', count: 50 },
    { prefix: 'user', count: 30 },
  ];
  
  const type = userTypes[Math.floor(Math.random() * userTypes.length)];
  const num = Math.floor(Math.random() * type.count) + 1;
  
  return {
    email: `${type.prefix}${num}@test.com`,
    password: 'Test123!@#',
    role: type.prefix.toUpperCase(),
  };
}

/**
 * Authenticate and return access token
 * @param {object} credentials - { email, password }
 * @returns {string} Access token
 */
export function authenticate(credentials = null) {
  const user = credentials || getRandomTestUser();
  
  const startTime = new Date();
  const response = http.post(
    `${BASE_URL}/auth/login`,
    JSON.stringify(user),
    {
      headers: { 'Content-Type': 'application/json' },
      tags: { name: 'authenticate' },
    }
  );
  
  const duration = new Date() - startTime;
  customMetrics.authDuration.add(duration);
  
  const success = check(response, {
    'auth: status is 200': (r) => r.status === 200,
    'auth: has access token': (r) => r.json('access_token') !== undefined,
  });
  
  customMetrics.authSuccessRate.add(success);
  
  if (!success) {
    customMetrics.authErrors.add(1);
    console.error(`Auth failed: ${response.status} - ${response.body}`);
    return null;
  }
  
  return response.json('access_token');
}

/**
 * Get authenticated request headers
 * @param {string} token - Access token
 * @returns {object} Headers object
 */
export function getAuthHeaders(token) {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  };
}

/**
 * Generate random query parameters
 * @param {object} options - Parameter options
 * @returns {string} Query string
 */
export function generateQueryParams(options = {}) {
  const params = [];
  
  if (options.page !== undefined) {
    params.push(`page=${options.page || Math.floor(Math.random() * 10) + 1}`);
  }
  
  if (options.limit !== undefined) {
    params.push(`limit=${options.limit || 20}`);
  }
  
  if (options.sortBy !== undefined) {
    params.push(`sortBy=${options.sortBy}`);
  }
  
  if (options.sortOrder !== undefined) {
    params.push(`sortOrder=${options.sortOrder || 'desc'}`);
  }
  
  if (options.fields !== undefined) {
    params.push(`fields=${options.fields}`);
  }
  
  if (options.search !== undefined) {
    params.push(`search=${options.search}`);
  }
  
  if (options.status !== undefined) {
    params.push(`status=${options.status}`);
  }
  
  if (options.startDate !== undefined) {
    params.push(`startDate=${options.startDate}`);
  }
  
  if (options.endDate !== undefined) {
    params.push(`endDate=${options.endDate}`);
  }
  
  return params.length > 0 ? `?${params.join('&')}` : '';
}

/**
 * Check if response indicates cache hit
 * @param {object} response - HTTP response
 * @returns {boolean} True if cache hit
 */
export function isCacheHit(response) {
  return response.headers['X-Cache-Hit'] === 'true' ||
         response.headers['x-cache-hit'] === 'true';
}

/**
 * Track cache performance
 * @param {object} response - HTTP response
 */
export function trackCachePerformance(response) {
  const hit = isCacheHit(response);
  customMetrics.cacheHitRate.add(hit);
  
  if (hit) {
    customMetrics.cacheResponseTime.add(response.timings.duration);
  } else {
    customMetrics.cacheMissTime.add(response.timings.duration);
  }
}

/**
 * Validate response structure
 * @param {object} response - HTTP response
 * @param {object} expectations - Expected structure
 * @returns {boolean} True if valid
 */
export function validateResponse(response, expectations = {}) {
  const checks = {
    'status is successful': (r) => 
      expectations.status ? r.status === expectations.status : r.status >= 200 && r.status < 300,
    'response has body': (r) => r.body && r.body.length > 0,
    'content-type is JSON': (r) => 
      r.headers['Content-Type']?.includes('application/json'),
  };
  
  if (expectations.hasData) {
    checks['response has data'] = (r) => {
      try {
        const json = r.json();
        return json && (json.data !== undefined || json.length > 0);
      } catch (e) {
        return false;
      }
    };
  }
  
  if (expectations.pagination) {
    checks['has pagination'] = (r) => {
      try {
        const json = r.json();
        return json.meta && json.meta.total !== undefined;
      } catch (e) {
        return false;
      }
    };
  }
  
  return check(response, checks);
}

/**
 * Random think time (simulates user reading/interaction)
 * @param {number} min - Minimum seconds
 * @param {number} max - Maximum seconds
 */
export function thinkTime(min = 1, max = 3) {
  const seconds = Math.random() * (max - min) + min;
  sleep(seconds);
}

/**
 * Generate realistic date range for analytics queries
 * @returns {object} { startDate, endDate }
 */
export function generateDateRange() {
  const ranges = [
    { days: 7, label: 'last_week' },
    { days: 30, label: 'last_month' },
    { days: 90, label: 'last_quarter' },
  ];
  
  const range = ranges[Math.floor(Math.random() * ranges.length)];
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - range.days);
  
  return {
    startDate: startDate.toISOString().split('T')[0],
    endDate: endDate.toISOString().split('T')[0],
  };
}

/**
 * Handle errors and track metrics
 * @param {object} response - HTTP response
 * @param {string} operation - Operation name
 */
export function handleErrors(response, operation = 'unknown') {
  if (response.status === 401 || response.status === 403) {
    customMetrics.authErrors.add(1);
  } else if (response.status === 400 || response.status === 422) {
    customMetrics.validationErrors.add(1);
  } else if (response.status >= 500) {
    customMetrics.serverErrors.add(1);
  } else if (response.error_code === 1000 || response.timings.duration > 30000) {
    customMetrics.timeoutErrors.add(1);
  }
  
  if (response.status !== 200) {
    console.error(`[${operation}] Error ${response.status}: ${response.body}`);
  }
}

/**
 * Generate random product search term
 * @returns {string} Search term
 */
export function getRandomSearchTerm() {
  const terms = [
    'mushroom', 'organic', 'fresh', 'shiitake', 'oyster',
    'button', 'portobello', 'king', 'enoki', 'maitake',
    'dried', 'spawn', 'substrate', 'grow kit', 'spores',
  ];
  return terms[Math.floor(Math.random() * terms.length)];
}

/**
 * Generate random device status
 * @returns {string} Status
 */
export function getRandomDeviceStatus() {
  const statuses = ['ONLINE', 'OFFLINE', 'MAINTENANCE'];
  const weights = [70, 20, 10]; // 70% online, 20% offline, 10% maintenance
  
  const rand = Math.random() * 100;
  let cumulative = 0;
  
  for (let i = 0; i < weights.length; i++) {
    cumulative += weights[i];
    if (rand <= cumulative) {
      return statuses[i];
    }
  }
  
  return statuses[0];
}

/**
 * Create test summary
 * @param {object} data - Test data
 * @returns {object} Summary
 */
export function handleSummary(data) {
  return {
    'stdout': textSummary(data, { indent: ' ', enableColors: true }),
    'summary.json': JSON.stringify(data, null, 2),
    'summary.html': htmlReport(data),
  };
}

/**
 * Calculate percentile
 * @param {Array} arr - Sorted array
 * @param {number} percentile - Percentile (0-1)
 * @returns {number} Value at percentile
 */
export function calculatePercentile(arr, percentile) {
  const sorted = arr.slice().sort((a, b) => a - b);
  const index = Math.ceil(sorted.length * percentile) - 1;
  return sorted[index];
}

/**
 * Format bytes to human-readable
 * @param {number} bytes - Bytes
 * @returns {string} Formatted string
 */
export function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Format duration to human-readable
 * @param {number} ms - Milliseconds
 * @returns {string} Formatted string
 */
export function formatDuration(ms) {
  if (ms < 1000) return `${ms.toFixed(2)}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`;
  return `${(ms / 60000).toFixed(2)}m`;
}

export default {
  BASE_URL,
  customMetrics,
  getRandomTestUser,
  authenticate,
  getAuthHeaders,
  generateQueryParams,
  isCacheHit,
  trackCachePerformance,
  validateResponse,
  thinkTime,
  generateDateRange,
  handleErrors,
  getRandomSearchTerm,
  getRandomDeviceStatus,
  handleSummary,
  calculatePercentile,
  formatBytes,
  formatDuration,
};
