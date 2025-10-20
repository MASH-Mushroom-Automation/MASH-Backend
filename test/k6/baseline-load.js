import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const apiResponseTime = new Trend('api_response_time');

// Test configuration
export const options = {
  stages: [
    { duration: '30s', target: 10 },  // Ramp-up to 10 users over 30s
    { duration: '1m', target: 10 },   // Stay at 10 users for 1 minute
    { duration: '30s', target: 0 },   // Ramp-down to 0 users
  ],
  thresholds: {
    'http_req_duration': ['p(95)<500'], // 95% of requests should be below 500ms
    'errors': ['rate<0.1'],              // Error rate should be less than 10%
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000/api/v1';

export default function () {
  // Test 1: Health Check
  let healthRes = http.get(`${BASE_URL.replace('/api/v1', '')}/api/v1/health`);
  check(healthRes, {
    'health check status is 200': (r) => r.status === 200,
    'health check has status field': (r) => JSON.parse(r.body).status !== undefined,
  }) || errorRate.add(1);
  apiResponseTime.add(healthRes.timings.duration);

  sleep(1);

  // Test 2: API Info
  let apiInfoRes = http.get(BASE_URL);
  check(apiInfoRes, {
    'api info status is 200': (r) => r.status === 200,
    'api info has version': (r) => JSON.parse(r.body).version !== undefined,
  }) || errorRate.add(1);
  apiResponseTime.add(apiInfoRes.timings.duration);

  sleep(1);

  // Test 3: Metrics Endpoint (Prometheus)
  let metricsRes = http.get(`${BASE_URL.replace('/api/v1', '')}/metrics`);
  check(metricsRes, {
    'metrics status is 200': (r) => r.status === 200,
    'metrics contains prometheus format': (r) => r.body.includes('# TYPE'),
  }) || errorRate.add(1);
  apiResponseTime.add(metricsRes.timings.duration);

  sleep(2);
}

export function handleSummary(data) {
  return {
    'stdout': textSummary(data, { indent: ' ', enableColors: true }),
  };
}

function textSummary(data, options) {
  const indent = options?.indent || '';
  const enableColors = options?.enableColors || false;

  const color = enableColors ? {
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    reset: '\x1b[0m',
  } : { green: '', red: '', yellow: '', reset: '' };

  let summary = '\n\n';
  summary += indent + '='.repeat(60) + '\n';
  summary += indent + '  k6 Baseline Load Test - Summary Report\n';
  summary += indent + '='.repeat(60) + '\n\n';

  const metrics = data.metrics;

  // HTTP Request Duration
  if (metrics.http_req_duration) {
    const duration = metrics.http_req_duration.values;
    summary += indent + 'HTTP Request Duration:\n';
    summary += indent + `  Average: ${duration.avg.toFixed(2)}ms\n`;
    summary += indent + `  Min: ${duration.min.toFixed(2)}ms\n`;
    summary += indent + `  Max: ${duration.max.toFixed(2)}ms\n`;
    summary += indent + `  P(50): ${duration['p(50)'].toFixed(2)}ms\n`;
    summary += indent + `  P(95): ${duration['p(95)'].toFixed(2)}ms ${duration['p(95)'] < 500 ? color.green + '✓' + color.reset : color.red + '✗' + color.reset}\n`;
    summary += indent + `  P(99): ${duration['p(99)'].toFixed(2)}ms\n\n`;
  }

  // Error Rate
  if (metrics.errors) {
    const errors = metrics.errors.values;
    const errorPct = (errors.rate * 100).toFixed(2);
    const errorStatus = errors.rate < 0.1 ? color.green + '✓' + color.reset : color.red + '✗' + color.reset;
    summary += indent + `Error Rate: ${errorPct}% ${errorStatus}\n\n`;
  }

  // HTTP Requests
  if (metrics.http_reqs) {
    const reqs = metrics.http_reqs.values;
    summary += indent + `Total HTTP Requests: ${reqs.count}\n`;
    summary += indent + `Request Rate: ${reqs.rate.toFixed(2)} req/s\n\n`;
  }

  // Virtual Users
  if (metrics.vus) {
    summary += indent + `Virtual Users: ${metrics.vus.values.value}\n`;
  }

  if (metrics.vus_max) {
    summary += indent + `Max VUs: ${metrics.vus_max.values.value}\n\n`;
  }

  // Data Transfer
  if (metrics.data_received) {
    const received = metrics.data_received.values.count;
    summary += indent + `Data Received: ${(received / 1024 / 1024).toFixed(2)} MB\n`;
  }

  if (metrics.data_sent) {
    const sent = metrics.data_sent.values.count;
    summary += indent + `Data Sent: ${(sent / 1024 / 1024).toFixed(2)} MB\n\n`;
  }

  summary += indent + '='.repeat(60) + '\n';

  return summary;
}
