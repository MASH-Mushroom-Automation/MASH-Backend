/**
 * Devices & Sensors API Load Test
 * 
 * Tests IoT device and sensor endpoints:
 * - GET /devices (list devices)
 * - GET /devices/:id (single device)
 * - GET /sensors (list sensors)
 * - GET /sensors/:id/readings (sensor readings)
 * 
 * Validates IoT-specific performance and caching
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
  getRandomDeviceStatus,
  handleErrors,
} from '../utils/helpers.js';

export function setup() {
  console.log('Setting up Devices & Sensors API test...');
  const token = authenticate();
  if (!token) throw new Error('Authentication failed');
  return { token };
}

export default function(data) {
  const headers = getAuthHeaders(data.token);
  
  group('Devices API - List Devices', () => {
    const response = http.get(
      `${BASE_URL}/devices${generateQueryParams({ page: 1, limit: 20 })}`,
      { headers, tags: { name: 'devices_list' } }
    );
    
    validateResponse(response, { hasData: true, pagination: true });
    trackCachePerformance(response);
    handleErrors(response, 'devices_list');
    
    check(response, {
      'devices: list returns 200': (r) => r.status === 200,
      'devices: has items': (r) => Array.isArray(r.json('data')),
      'devices: has pagination': (r) => r.json('meta') !== undefined,
    });
    
    thinkTime(1, 2);
  });
  
  group('Devices API - Single Device', () => {
    // Get a device ID
    const listResponse = http.get(
      `${BASE_URL}/devices${generateQueryParams({ page: 1, limit: 1 })}`,
      { headers, tags: { name: 'devices_get_id' } }
    );
    
    let deviceId = null;
    if (listResponse.status === 200) {
      const items = listResponse.json('data');
      if (items && items.length > 0) deviceId = items[0].id;
    }
    
    if (deviceId) {
      thinkTime(0.5, 1);
      
      const response = http.get(
        `${BASE_URL}/devices/${deviceId}`,
        { headers, tags: { name: 'devices_get_single' } }
      );
      
      validateResponse(response, { hasData: true });
      trackCachePerformance(response);
      handleErrors(response, 'devices_get_single');
      
      check(response, {
        'device: returns 200': (r) => r.status === 200,
        'device: has id': (r) => r.json('id') !== undefined,
        'device: has status': (r) => r.json('status') !== undefined,
        'device: has name': (r) => r.json('name') !== undefined,
      });
    }
    
    thinkTime(1, 2);
  });
  
  group('Devices API - Filter by Status', () => {
    const status = getRandomDeviceStatus();
    const response = http.get(
      `${BASE_URL}/devices${generateQueryParams({ 
        page: 1, 
        limit: 20,
        status: status
      })}`,
      { headers, tags: { name: 'devices_filter_status' } }
    );
    
    validateResponse(response, { hasData: true });
    trackCachePerformance(response);
    
    thinkTime(1, 2);
  });
  
  group('Sensors API - List Sensors', () => {
    const response = http.get(
      `${BASE_URL}/sensors${generateQueryParams({ page: 1, limit: 20 })}`,
      { headers, tags: { name: 'sensors_list' } }
    );
    
    validateResponse(response, { hasData: true, pagination: true });
    trackCachePerformance(response);
    handleErrors(response, 'sensors_list');
    
    check(response, {
      'sensors: list returns 200': (r) => r.status === 200,
      'sensors: has items': (r) => Array.isArray(r.json('data')),
    });
    
    thinkTime(1, 2);
  });
  
  group('Sensors API - Sensor Readings', () => {
    // Get a sensor ID
    const listResponse = http.get(
      `${BASE_URL}/sensors${generateQueryParams({ page: 1, limit: 1 })}`,
      { headers, tags: { name: 'sensors_get_id' } }
    );
    
    let sensorId = null;
    if (listResponse.status === 200) {
      const items = listResponse.json('data');
      if (items && items.length > 0) sensorId = items[0].id;
    }
    
    if (sensorId) {
      thinkTime(0.5, 1);
      
      // Get recent readings
      const response = http.get(
        `${BASE_URL}/sensors/${sensorId}/readings${generateQueryParams({ 
          page: 1, 
          limit: 50 
        })}`,
        { headers, tags: { name: 'sensors_readings' } }
      );
      
      validateResponse(response, { hasData: true });
      trackCachePerformance(response);
      handleErrors(response, 'sensors_readings');
      
      check(response, {
        'readings: returns 200': (r) => r.status === 200,
        'readings: has data': (r) => Array.isArray(r.json('data')),
      });
    }
    
    thinkTime(2, 3);
  });
  
  thinkTime(2, 4);
}

export function teardown(data) {
  console.log('Devices & Sensors API test completed');
}
