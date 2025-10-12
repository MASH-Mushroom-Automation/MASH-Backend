/**
 * k6 Test Options Configuration
 * 
 * Defines load profiles for different test scenarios:
 * - Smoke: Minimal load validation
 * - Load: Sustained production load
 * - Stress: Breaking point analysis
 * - Spike: Burst traffic simulation
 * - Soak: Endurance testing
 * 
 * @see https://k6.io/docs/using-k6/k6-options/
 */

import { getThresholds } from './thresholds.js';

/**
 * Smoke Test Options
 * Purpose: Verify the script works and the system can handle minimal load
 * Duration: 5 minutes
 * VUs: 1-10
 */
export const SMOKE_OPTIONS = {
  stages: [
    { duration: '1m', target: 1 },    // Ramp up to 1 VU
    { duration: '2m', target: 10 },   // Ramp up to 10 VUs
    { duration: '1m', target: 10 },   // Stay at 10 VUs
    { duration: '1m', target: 0 },    // Ramp down to 0
  ],
  thresholds: getThresholds('smoke'),
  tags: { test_type: 'smoke' },
};

/**
 * Load Test Options
 * Purpose: Test system under expected production load
 * Duration: 20 minutes
 * VUs: 1-500
 */
export const LOAD_OPTIONS = {
  stages: [
    { duration: '2m', target: 50 },    // Warm-up to 50 VUs
    { duration: '3m', target: 100 },   // Ramp to 100 VUs
    { duration: '5m', target: 100 },   // Stay at 100 VUs
    { duration: '3m', target: 300 },   // Ramp to 300 VUs
    { duration: '5m', target: 300 },   // Stay at 300 VUs (target load)
    { duration: '2m', target: 0 },     // Ramp down
  ],
  thresholds: getThresholds('load'),
  tags: { test_type: 'load' },
};

/**
 * Stress Test Options
 * Purpose: Find breaking point and system limits
 * Duration: 25 minutes
 * VUs: 1-1500
 */
export const STRESS_OPTIONS = {
  stages: [
    { duration: '2m', target: 100 },   // Warm-up
    { duration: '3m', target: 300 },   // Normal load
    { duration: '3m', target: 500 },   // Above normal
    { duration: '3m', target: 800 },   // High load
    { duration: '3m', target: 1000 },  // Very high load
    { duration: '3m', target: 1500 },  // Breaking point
    { duration: '3m', target: 1500 },  // Maintain breaking point
    { duration: '5m', target: 0 },     // Recovery
  ],
  thresholds: getThresholds('stress'),
  tags: { test_type: 'stress' },
};

/**
 * Spike Test Options
 * Purpose: Test system behavior under sudden traffic spikes
 * Duration: 15 minutes
 * VUs: Spikes from 100 to 1000
 */
export const SPIKE_OPTIONS = {
  stages: [
    { duration: '2m', target: 100 },   // Normal load
    { duration: '1m', target: 1000 },  // Spike to 1000 VUs
    { duration: '3m', target: 1000 },  // Stay at spike
    { duration: '1m', target: 100 },   // Drop back to normal
    { duration: '3m', target: 100 },   // Stay at normal (recovery)
    { duration: '1m', target: 1000 },  // Second spike
    { duration: '2m', target: 1000 },  // Stay at spike
    { duration: '2m', target: 0 },     // Ramp down
  ],
  thresholds: getThresholds('spike'),
  tags: { test_type: 'spike' },
};

/**
 * Soak Test Options
 * Purpose: Test system stability over extended period
 * Duration: 2 hours
 * VUs: 200 constant
 */
export const SOAK_OPTIONS = {
  stages: [
    { duration: '5m', target: 200 },   // Ramp up to sustained load
    { duration: '110m', target: 200 }, // Maintain for ~2 hours
    { duration: '5m', target: 0 },     // Ramp down
  ],
  thresholds: getThresholds('soak'),
  tags: { test_type: 'soak' },
};

/**
 * Baseline Test Options
 * Purpose: Quick baseline measurement (Phase 5.2)
 * Duration: 10 minutes
 * VUs: Progressive 10 → 100 → 500
 */
export const BASELINE_OPTIONS = {
  stages: [
    { duration: '2m', target: 10 },    // Smoke level
    { duration: '2m', target: 100 },   // Load level
    { duration: '3m', target: 500 },   // Stress level
    { duration: '2m', target: 500 },   // Sustain stress
    { duration: '1m', target: 0 },     // Ramp down
  ],
  thresholds: getThresholds('load'),
  tags: { test_type: 'baseline' },
};

/**
 * Quick Test Options
 * Purpose: Fast validation during development
 * Duration: 3 minutes
 * VUs: 1-50
 */
export const QUICK_OPTIONS = {
  stages: [
    { duration: '30s', target: 10 },   // Quick ramp
    { duration: '1m', target: 50 },    // Peak
    { duration: '1m', target: 50 },    // Sustain
    { duration: '30s', target: 0 },    // Ramp down
  ],
  thresholds: getThresholds('smoke'),
  tags: { test_type: 'quick' },
};

/**
 * API-Specific Options
 * Lighter load profiles for individual API testing
 */
export const API_TEST_OPTIONS = {
  stages: [
    { duration: '1m', target: 20 },    // Ramp up
    { duration: '3m', target: 50 },    // Test load
    { duration: '1m', target: 0 },     // Ramp down
  ],
  thresholds: getThresholds('load'),
  tags: { test_type: 'api' },
};

/**
 * Global Settings (Applied to all tests)
 */
export const GLOBAL_OPTIONS = {
  // HTTP Configuration
  noConnectionReuse: false,              // Allow connection reuse (realistic)
  userAgent: 'k6-load-test/1.0',        // Custom user agent
  
  // Batch Requests
  batch: 10,                             // Batch up to 10 requests
  batchPerHost: 6,                       // Max 6 batched requests per host
  
  // Timeouts
  httpDebug: 'full',                     // Detailed HTTP logs for debugging
  
  // Data Collection
  summaryTrendStats: [
    'avg', 'min', 'med', 'max', 
    'p(90)', 'p(95)', 'p(99)', 'p(99.9)',
  ],
  
  // Scenario Executor
  discardResponseBodies: false,          // Keep response bodies for validation
  
  // Cloud Configuration (if using k6 Cloud)
  ext: {
    loadimpact: {
      projectID: 0,
      name: 'MASH Backend Performance Test',
    },
  },
};

/**
 * Get options based on test type
 * @param {string} testType - 'smoke', 'load', 'stress', 'spike', 'soak', 'baseline', 'quick'
 * @returns {object} k6 options configuration
 */
export function getOptions(testType = 'load') {
  const options = {
    smoke: SMOKE_OPTIONS,
    load: LOAD_OPTIONS,
    stress: STRESS_OPTIONS,
    spike: SPIKE_OPTIONS,
    soak: SOAK_OPTIONS,
    baseline: BASELINE_OPTIONS,
    quick: QUICK_OPTIONS,
    api: API_TEST_OPTIONS,
  };

  return { ...GLOBAL_OPTIONS, ...(options[testType] || LOAD_OPTIONS) };
}

/**
 * Custom Executor Configuration
 * For more complex test scenarios
 */
export const EXECUTOR_CONFIGS = {
  // Constant VUs for entire duration
  constant: (vus, duration) => ({
    executor: 'constant-vus',
    vus,
    duration,
  }),

  // Ramping VUs (stages)
  ramping: (stages) => ({
    executor: 'ramping-vus',
    startVUs: 0,
    stages,
  }),

  // Constant Request Rate
  constantRate: (rate, duration) => ({
    executor: 'constant-arrival-rate',
    rate,
    timeUnit: '1s',
    duration,
    preAllocatedVUs: rate * 2,
    maxVUs: rate * 10,
  }),

  // Per VU Iterations
  perVU: (iterations, vus) => ({
    executor: 'per-vu-iterations',
    vus,
    iterations,
  }),

  // Shared Iterations
  shared: (iterations, vus) => ({
    executor: 'shared-iterations',
    vus,
    iterations,
  }),
};

export default {
  SMOKE_OPTIONS,
  LOAD_OPTIONS,
  STRESS_OPTIONS,
  SPIKE_OPTIONS,
  SOAK_OPTIONS,
  BASELINE_OPTIONS,
  QUICK_OPTIONS,
  API_TEST_OPTIONS,
  GLOBAL_OPTIONS,
  EXECUTOR_CONFIGS,
  getOptions,
};
