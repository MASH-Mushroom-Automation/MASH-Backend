/**
 * Stress Test Scenario
 * 
 * Purpose: Find breaking point and system limits
 * Duration: 25 minutes
 * VUs: 1-1500
 * Target: Find maximum req/s before failure
 * 
 * Run: k6 run test/k6/scenarios/stress.js
 */

import { STRESS_OPTIONS } from '../config/options.js';
import productsTest from '../tests/products.test.js';
import ordersTest from '../tests/orders.test.js';
import analyticsTest from '../tests/analytics.test.js';
import devicesTest from '../tests/devices.test.js';

export const options = STRESS_OPTIONS;

export function setup() {
  console.log('========================================');
  console.log('🔥 STRESS TEST - Starting');
  console.log('========================================');
  console.log('Duration: 25 minutes');
  console.log('VUs: 1-1500');
  console.log('Purpose: Find breaking point');
  console.log('Expected: System degradation at high load');
  console.log('Watch for:');
  console.log('  - Response time increases');
  console.log('  - Error rate increases');
  console.log('  - Database connection saturation');
  console.log('  - Memory/CPU spikes');
  console.log('========================================\n');
  
  return { testType: 'stress' };
}

export default function(data) {
  // Realistic distribution
  const rand = Math.random();
  
  if (rand < 0.30) {
    productsTest.default(productsTest.setup());
  } else if (rand < 0.55) {
    ordersTest.default(ordersTest.setup());
  } else if (rand < 0.75) {
    devicesTest.default(devicesTest.setup());
  } else {
    analyticsTest.default(analyticsTest.setup());
  }
}

export function teardown(data) {
  console.log('\n========================================');
  console.log('✅ STRESS TEST - Completed');
  console.log('========================================');
  console.log('Analysis points:');
  console.log('  1. At what VU count did P95 exceed 500ms?');
  console.log('  2. At what VU count did errors start?');
  console.log('  3. Maximum sustained req/s achieved?');
  console.log('  4. Recovery time after peak load?');
  console.log('========================================');
}
