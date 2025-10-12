/**
 * k6 Performance Thresholds Configuration
 * 
 * These thresholds are based on the Performance Optimization goals:
 * - Target: 500+ req/s throughput
 * - P95 Latency: <200ms
 * - Error Rate: <1%
 * - Cache Hit Rate: 80%+
 * 
 * @see documents/PERFORMANCE_OPTIMIZATION_PLAN.md
 */

export const PERFORMANCE_THRESHOLDS = {
  // HTTP Request Duration Thresholds
  http_req_duration: [
    'p(50)<50',    // 50th percentile should be < 50ms (median)
    'p(95)<200',   // 95th percentile should be < 200ms (target)
    'p(99)<500',   // 99th percentile should be < 500ms
    'avg<100',     // Average response time < 100ms
  ],

  // HTTP Request Success Rate
  http_req_failed: [
    'rate<0.01',   // Error rate should be < 1%
  ],

  // Request Rate (Throughput)
  http_reqs: [
    'rate>100',    // Minimum 100 req/s (conservative baseline)
  ],

  // Connection Duration
  http_req_connecting: [
    'p(95)<100',   // Connection time should be < 100ms
  ],

  // Time to First Byte
  http_req_waiting: [
    'p(95)<150',   // Waiting time should be < 150ms
  ],

  // Request Sending Time
  http_req_sending: [
    'p(95)<10',    // Sending time should be < 10ms
  ],

  // Response Receiving Time
  http_req_receiving: [
    'p(95)<20',    // Receiving time should be < 20ms
  ],

  // Iteration Duration (full iteration including think time)
  iteration_duration: [
    'p(95)<2000',  // Full iteration should complete < 2s
  ],

  // Virtual User Blocked Time
  http_req_blocked: [
    'p(95)<100',   // Blocked time should be < 100ms
  ],
};

/**
 * Smoke Test Thresholds (Less Strict)
 * Used for initial validation with minimal load
 */
export const SMOKE_THRESHOLDS = {
  http_req_duration: ['p(95)<300'],  // More lenient during warm-up
  http_req_failed: ['rate<0.05'],     // Allow 5% errors during smoke test
};

/**
 * Load Test Thresholds (Target Performance)
 * Used for sustained load testing at expected production levels
 */
export const LOAD_THRESHOLDS = {
  ...PERFORMANCE_THRESHOLDS,
  http_reqs: ['rate>300'],            // Target 300+ req/s for load tests
};

/**
 * Stress Test Thresholds (Breaking Point)
 * Used for finding system limits - more lenient on response times
 */
export const STRESS_THRESHOLDS = {
  http_req_duration: [
    'p(95)<500',   // Allow slower responses under stress
    'p(99)<1000',  // 99th percentile < 1s
  ],
  http_req_failed: ['rate<0.05'],     // Allow 5% errors at breaking point
  http_reqs: ['rate>500'],            // Target 500+ req/s for stress tests
};

/**
 * Spike Test Thresholds (Burst Traffic)
 * Used for sudden traffic spikes - focus on stability
 */
export const SPIKE_THRESHOLDS = {
  http_req_duration: ['p(95)<400'],   // Allow slower responses during spike
  http_req_failed: ['rate<0.03'],     // Allow 3% errors during spike
};

/**
 * Soak Test Thresholds (Endurance)
 * Used for long-running tests - focus on stability over time
 */
export const SOAK_THRESHOLDS = {
  ...PERFORMANCE_THRESHOLDS,
  http_req_failed: ['rate<0.005'],    // Very low error rate for endurance
};

/**
 * API-Specific Thresholds
 * Different endpoints have different performance characteristics
 */
export const API_THRESHOLDS = {
  // Cheap Operations (Health checks, config)
  cheap: {
    http_req_duration: ['p(95)<50', 'avg<20'],
    http_req_failed: ['rate<0.001'],
  },

  // Standard CRUD Operations
  standard: {
    http_req_duration: ['p(95)<150', 'avg<75'],
    http_req_failed: ['rate<0.01'],
  },

  // Expensive Operations (Analytics, Reports)
  expensive: {
    http_req_duration: ['p(95)<500', 'avg<250'],
    http_req_failed: ['rate<0.02'],
  },

  // Database-Heavy Operations
  database: {
    http_req_duration: ['p(95)<200', 'avg<100'],
    http_req_failed: ['rate<0.01'],
  },

  // Cache-Heavy Operations
  cache: {
    http_req_duration: ['p(95)<50', 'avg<25'],
    http_req_failed: ['rate<0.005'],
  },
};

/**
 * Custom Check Thresholds
 * For business logic validation
 */
export const CHECK_THRESHOLDS = {
  // Response Body Validation
  'response_has_data': ['rate>0.99'],          // 99% of responses should have data
  'response_format_valid': ['rate>0.99'],      // 99% should have valid format
  
  // Cache Performance
  'cache_hit_rate': ['rate>0.80'],             // 80%+ cache hit rate (target)
  'cache_response_fast': ['rate>0.95'],        // 95% cache responses < 50ms
  
  // Authentication
  'auth_success': ['rate>0.99'],               // 99% auth should succeed
  'token_valid': ['rate>0.99'],                // 99% tokens should be valid
  
  // Pagination
  'pagination_works': ['rate>0.99'],           // 99% pagination should work
  'has_next_page': ['rate>0.5'],               // At least 50% should have next page
  
  // Field Selection
  'field_selection_works': ['rate>0.99'],      // 99% field selection should work
  'response_size_reduced': ['rate>0.90'],      // 90% should have reduced size
};

/**
 * Get thresholds based on test type
 * @param {string} testType - 'smoke', 'load', 'stress', 'spike', 'soak'
 * @returns {object} Threshold configuration
 */
export function getThresholds(testType = 'load') {
  const thresholds = {
    smoke: SMOKE_THRESHOLDS,
    load: LOAD_THRESHOLDS,
    stress: STRESS_THRESHOLDS,
    spike: SPIKE_THRESHOLDS,
    soak: SOAK_THRESHOLDS,
  };

  return thresholds[testType] || LOAD_THRESHOLDS;
}

/**
 * Merge thresholds for combined tests
 * @param {...object} thresholdObjects - Threshold objects to merge
 * @returns {object} Merged thresholds
 */
export function mergeThresholds(...thresholdObjects) {
  return Object.assign({}, ...thresholdObjects);
}

export default {
  PERFORMANCE_THRESHOLDS,
  SMOKE_THRESHOLDS,
  LOAD_THRESHOLDS,
  STRESS_THRESHOLDS,
  SPIKE_THRESHOLDS,
  SOAK_THRESHOLDS,
  API_THRESHOLDS,
  CHECK_THRESHOLDS,
  getThresholds,
  mergeThresholds,
};
