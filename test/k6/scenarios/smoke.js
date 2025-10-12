/**
 * Smoke Test Scenario
 * 
 * Purpose: Quick validation that all APIs work with minimal load
 * Duration: 5 minutes
 * VUs: 1-10
 * 
 * Run: k6 run test/k6/scenarios/smoke.js
 */

import { SMOKE_OPTIONS } from '../config/options.js';
import productsTest from '../tests/products.test.js';
import ordersTest from '../tests/orders.test.js';
import analyticsTest from '../tests/analytics.test.js';
import devicesTest from '../tests/devices.test.js';

export const options = SMOKE_OPTIONS;

// Setup runs once at the beginning
export function setup() {
  console.log('========================================');
  console.log('🔥 SMOKE TEST - Starting');
  console.log('========================================');
  console.log('Duration: 5 minutes');
  console.log('VUs: 1-10');
  console.log('Purpose: Quick validation');
  console.log('========================================\n');
  
  // Each test will handle its own authentication
  return { testType: 'smoke' };
}

// Main test function - runs for each VU
export default function(data) {
  // Randomly select which API to test (distribute load)
  const rand = Math.random();
  
  if (rand < 0.4) {
    // 40% - Products API (most common)
    productsTest.default(productsTest.setup());
  } else if (rand < 0.7) {
    // 30% - Orders API
    ordersTest.default(ordersTest.setup());
  } else if (rand < 0.85) {
    // 15% - Devices API
    devicesTest.default(devicesTest.setup());
  } else {
    // 15% - Analytics API (least common, expensive)
    analyticsTest.default(analyticsTest.setup());
  }
}

// Teardown runs once at the end
export function teardown(data) {
  console.log('\n========================================');
  console.log('✅ SMOKE TEST - Completed');
  console.log('========================================');
}
