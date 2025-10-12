/**
 * Load Test Scenario
 * 
 * Purpose: Test system under expected production load
 * Duration: 20 minutes
 * VUs: 1-300
 * Target: 300+ req/s sustained
 * 
 * Run: k6 run test/k6/scenarios/load.js
 */

import { LOAD_OPTIONS } from '../config/options.js';
import productsTest from '../tests/products.test.js';
import ordersTest from '../tests/orders.test.js';
import analyticsTest from '../tests/analytics.test.js';
import devicesTest from '../tests/devices.test.js';

export const options = LOAD_OPTIONS;

export function setup() {
  console.log('========================================');
  console.log('⚡ LOAD TEST - Starting');
  console.log('========================================');
  console.log('Duration: 20 minutes');
  console.log('VUs: 1-300');
  console.log('Target: 300+ req/s sustained');
  console.log('Thresholds:');
  console.log('  - P95 latency < 200ms');
  console.log('  - Error rate < 1%');
  console.log('  - Cache hit rate > 80%');
  console.log('========================================\n');
  
  return { testType: 'load' };
}

export default function(data) {
  // Distribute load realistically
  const rand = Math.random();
  
  if (rand < 0.35) {
    // 35% - Products API (browsing products)
    productsTest.default(productsTest.setup());
  } else if (rand < 0.60) {
    // 25% - Orders API (creating/viewing orders)
    ordersTest.default(ordersTest.setup());
  } else if (rand < 0.80) {
    // 20% - Devices API (IoT monitoring)
    devicesTest.default(devicesTest.setup());
  } else {
    // 20% - Analytics API (reporting)
    analyticsTest.default(analyticsTest.setup());
  }
}

export function teardown(data) {
  console.log('\n========================================');
  console.log('✅ LOAD TEST - Completed');
  console.log('========================================');
  console.log('Check metrics against thresholds:');
  console.log('  ✓ http_req_duration p(95) < 200ms');
  console.log('  ✓ http_req_failed < 1%');
  console.log('  ✓ http_reqs rate > 300/s');
  console.log('  ✓ cache_hit_rate > 80%');
  console.log('========================================');
}
