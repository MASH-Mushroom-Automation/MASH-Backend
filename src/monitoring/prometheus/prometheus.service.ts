/**
 * PrometheusService - Custom metrics collection and management
 *
 * Metrics Categories:
 * 1. HTTP Metrics - Request count, duration, errors
 * 2. Database Metrics - Query count, duration, errors
 * 3. Cache Metrics - Hit rate, miss rate, operations
 * 4. Rate Limiting Metrics - Violations, backoff, whitelist
 * 5. Business Metrics - Orders, products, users activity
 *
 * All metrics use 'mash_' prefix for consistency
 */

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Counter, Histogram, Gauge, Summary, register } from 'prom-client';

@Injectable()
export class PrometheusService implements OnModuleInit {
  private readonly logger = new Logger(PrometheusService.name);

  // ============================================================================
  // HTTP Metrics
  // ============================================================================

  public httpRequestsTotal!: Counter<string>;
  public httpRequestDuration!: Histogram<string>;
  public httpRequestErrors!: Counter<string>;
  public httpResponseSize!: Summary<string>;

  // ============================================================================
  // Database Metrics
  // ============================================================================

  public dbQueriesTotal!: Counter<string>;
  public dbQueryDuration!: Histogram<string>;
  public dbQueryErrors!: Counter<string>;
  public dbConnectionsActive!: Gauge<string>;
  public dbConnectionsIdle!: Gauge<string>;

  // ============================================================================
  // Cache Metrics
  // ============================================================================

  public cacheHitsTotal!: Counter<string>;
  public cacheMissesTotal!: Counter<string>;
  public cacheOperationDuration!: Histogram<string>;
  public cacheKeyCount!: Gauge<string>;
  public cacheMemoryUsage!: Gauge<string>;
  public cacheHitRate!: Gauge<string>;

  // ============================================================================
  // Rate Limiting Metrics
  // ============================================================================

  public rateLimitViolationsTotal!: Counter<string>;
  public rateLimitBackoffActive!: Gauge<string>;
  public rateLimitWhitelistedRequests!: Counter<string>;
  public rateLimitQuotaUsage!: Gauge<string>;

  // ============================================================================
  // Business Metrics
  // ============================================================================

  public usersRegisteredTotal!: Counter<string>;
  public ordersTotal!: Counter<string>;
  public orderValue!: Summary<string>;
  public productsViewed!: Counter<string>;
  public usersActive!: Gauge<string>;
  public devicesConnected!: Gauge<string>;
  public sensorsActive!: Gauge<string>;

  // ============================================================================
  // Cart & E-commerce Metrics (Phase 7)
  // ============================================================================

  public cartItemsAdded!: Counter<string>;
  public cartItemsRemoved!: Counter<string>;
  public cartCheckoutsTotal!: Counter<string>;
  public cartCheckoutValue!: Summary<string>;
  public cartAbandonmentTotal!: Counter<string>;
  public cartActiveCarts!: Gauge<string>;
  public shippingCalculations!: Counter<string>;
  public taxCollected!: Counter<string>;
  public shippingRevenue!: Counter<string>;

  // ============================================================================
  // API Endpoint Metrics
  // ============================================================================

  public apiEndpointRequests!: Counter<string>;
  public apiEndpointDuration!: Histogram<string>;
  public apiEndpointErrors!: Counter<string>;

  onModuleInit() {
    this.initializeMetrics();
    this.logger.log('✅ Prometheus metrics initialized');
  }

  /**
   * Initialize all Prometheus metrics
   */
  private initializeMetrics() {
    // HTTP Metrics
    this.httpRequestsTotal = new Counter({
      name: 'mash_http_requests_total',
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'route', 'status_code'],
      registers: [register],
    });

    this.httpRequestDuration = new Histogram({
      name: 'mash_http_request_duration_seconds',
      help: 'Duration of HTTP requests in seconds',
      labelNames: ['method', 'route', 'status_code'],
      buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10],
      registers: [register],
    });

    this.httpRequestErrors = new Counter({
      name: 'mash_http_request_errors_total',
      help: 'Total number of HTTP request errors',
      labelNames: ['method', 'route', 'error_type'],
      registers: [register],
    });

    this.httpResponseSize = new Summary({
      name: 'mash_http_response_size_bytes',
      help: 'Size of HTTP responses in bytes',
      labelNames: ['method', 'route'],
      registers: [register],
    });

    // Database Metrics
    this.dbQueriesTotal = new Counter({
      name: 'mash_db_queries_total',
      help: 'Total number of database queries',
      labelNames: ['operation', 'model', 'status'],
      registers: [register],
    });

    this.dbQueryDuration = new Histogram({
      name: 'mash_db_query_duration_seconds',
      help: 'Duration of database queries in seconds',
      labelNames: ['operation', 'model'],
      buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1],
      registers: [register],
    });

    this.dbQueryErrors = new Counter({
      name: 'mash_db_query_errors_total',
      help: 'Total number of database query errors',
      labelNames: ['operation', 'model', 'error_type'],
      registers: [register],
    });

    this.dbConnectionsActive = new Gauge({
      name: 'mash_db_connections_active',
      help: 'Number of active database connections',
      registers: [register],
    });

    this.dbConnectionsIdle = new Gauge({
      name: 'mash_db_connections_idle',
      help: 'Number of idle database connections',
      registers: [register],
    });

    // Cache Metrics
    this.cacheHitsTotal = new Counter({
      name: 'mash_cache_hits_total',
      help: 'Total number of cache hits',
      labelNames: ['cache_key_prefix'],
      registers: [register],
    });

    this.cacheMissesTotal = new Counter({
      name: 'mash_cache_misses_total',
      help: 'Total number of cache misses',
      labelNames: ['cache_key_prefix'],
      registers: [register],
    });

    this.cacheOperationDuration = new Histogram({
      name: 'mash_cache_operation_duration_seconds',
      help: 'Duration of cache operations in seconds',
      labelNames: ['operation', 'cache_key_prefix'],
      buckets: [0.001, 0.005, 0.01, 0.05, 0.1],
      registers: [register],
    });

    this.cacheKeyCount = new Gauge({
      name: 'mash_cache_key_count',
      help: 'Number of keys in cache',
      labelNames: ['cache_key_prefix'],
      registers: [register],
    });

    this.cacheMemoryUsage = new Gauge({
      name: 'mash_cache_memory_usage_bytes',
      help: 'Memory usage of cache in bytes',
      registers: [register],
    });

    this.cacheHitRate = new Gauge({
      name: 'mash_cache_hit_rate',
      help: 'Cache hit rate percentage',
      registers: [register],
    });

    // Rate Limiting Metrics
    this.rateLimitViolationsTotal = new Counter({
      name: 'mash_rate_limit_violations_total',
      help: 'Total number of rate limit violations',
      labelNames: ['user_role', 'endpoint_category', 'source'],
      registers: [register],
    });

    this.rateLimitBackoffActive = new Gauge({
      name: 'mash_rate_limit_backoff_active',
      help: 'Number of users currently in backoff period',
      registers: [register],
    });

    this.rateLimitWhitelistedRequests = new Counter({
      name: 'mash_rate_limit_whitelisted_requests_total',
      help: 'Total number of whitelisted requests that bypassed rate limiting',
      labelNames: ['identifier'],
      registers: [register],
    });

    this.rateLimitQuotaUsage = new Gauge({
      name: 'mash_rate_limit_quota_usage_percent',
      help: 'Current quota usage percentage',
      labelNames: ['user_id', 'quota_type'],
      registers: [register],
    });

    // Business Metrics
    this.usersRegisteredTotal = new Counter({
      name: 'mash_users_registered_total',
      help: 'Total number of registered users',
      registers: [register],
    });

    this.ordersTotal = new Counter({
      name: 'mash_orders_total',
      help: 'Total number of orders created',
      labelNames: ['status', 'payment_method'],
      registers: [register],
    });

    this.orderValue = new Summary({
      name: 'mash_order_value_php',
      help: 'Order value in PHP',
      labelNames: ['status'],
      registers: [register],
    });

    this.productsViewed = new Counter({
      name: 'mash_products_viewed_total',
      help: 'Total number of product views',
      labelNames: ['product_id', 'category'],
      registers: [register],
    });

    this.usersActive = new Gauge({
      name: 'mash_users_active',
      help: 'Number of currently active users',
      registers: [register],
    });

    this.devicesConnected = new Gauge({
      name: 'mash_devices_connected',
      help: 'Number of connected IoT devices',
      registers: [register],
    });

    this.sensorsActive = new Gauge({
      name: 'mash_sensors_active',
      help: 'Number of active sensors',
      labelNames: ['sensor_type'],
      registers: [register],
    });

    // Cart & E-commerce Metrics (Phase 7)
    this.cartItemsAdded = new Counter({
      name: 'mash_cart_items_added_total',
      help: 'Total number of items added to carts',
      labelNames: ['product_id', 'user_type'], // user_type: guest, authenticated
      registers: [register],
    });

    this.cartItemsRemoved = new Counter({
      name: 'mash_cart_items_removed_total',
      help: 'Total number of items removed from carts',
      labelNames: ['product_id', 'user_type'],
      registers: [register],
    });

    this.cartCheckoutsTotal = new Counter({
      name: 'mash_cart_checkouts_total',
      help: 'Total number of successful cart checkouts',
      labelNames: ['payment_method'],
      registers: [register],
    });

    this.cartCheckoutValue = new Summary({
      name: 'mash_cart_checkout_value_php',
      help: 'Checkout value in PHP',
      labelNames: ['payment_method'],
      registers: [register],
    });

    this.cartAbandonmentTotal = new Counter({
      name: 'mash_cart_abandonment_total',
      help: 'Total number of abandoned carts',
      labelNames: ['user_type'],
      registers: [register],
    });

    this.cartActiveCarts = new Gauge({
      name: 'mash_cart_active_carts',
      help: 'Number of currently active carts',
      labelNames: ['user_type'],
      registers: [register],
    });

    this.shippingCalculations = new Counter({
      name: 'mash_shipping_calculations_total',
      help: 'Total number of shipping cost calculations',
      labelNames: ['method', 'region'], // method: STANDARD, EXPRESS, SAME_DAY
      registers: [register],
    });

    this.taxCollected = new Counter({
      name: 'mash_tax_collected_php_total',
      help: 'Total tax collected in PHP',
      labelNames: ['region'], // NCR, Province
      registers: [register],
    });

    this.shippingRevenue = new Counter({
      name: 'mash_shipping_revenue_php_total',
      help: 'Total shipping revenue in PHP',
      labelNames: ['method'],
      registers: [register],
    });

    // API Endpoint Metrics
    this.apiEndpointRequests = new Counter({
      name: 'mash_api_endpoint_requests_total',
      help: 'Total number of requests per API endpoint',
      labelNames: ['module', 'endpoint', 'method'],
      registers: [register],
    });

    this.apiEndpointDuration = new Histogram({
      name: 'mash_api_endpoint_duration_seconds',
      help: 'Duration of API endpoint requests in seconds',
      labelNames: ['module', 'endpoint', 'method'],
      buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5],
      registers: [register],
    });

    this.apiEndpointErrors = new Counter({
      name: 'mash_api_endpoint_errors_total',
      help: 'Total number of errors per API endpoint',
      labelNames: ['module', 'endpoint', 'method', 'error_type'],
      registers: [register],
    });
  }

  /**
   * Record HTTP request metrics
   */
  recordHttpRequest(
    method: string,
    route: string,
    statusCode: number,
    duration: number,
    responseSize?: number,
  ) {
    this.httpRequestsTotal.labels(method, route, statusCode.toString()).inc();
    this.httpRequestDuration.labels(method, route, statusCode.toString()).observe(duration / 1000); // Convert ms to seconds

    if (responseSize) {
      this.httpResponseSize.labels(method, route).observe(responseSize);
    }

    if (statusCode >= 400) {
      const errorType = statusCode >= 500 ? 'server_error' : 'client_error';
      this.httpRequestErrors.labels(method, route, errorType).inc();
    }
  }

  /**
   * Record database query metrics
   */
  recordDbQuery(
    operation: string,
    model: string,
    duration: number,
    status: 'success' | 'error',
    errorType?: string,
  ) {
    this.dbQueriesTotal.labels(operation, model, status).inc();
    this.dbQueryDuration.labels(operation, model).observe(duration / 1000);

    if (status === 'error' && errorType) {
      this.dbQueryErrors.labels(operation, model, errorType).inc();
    }
  }

  /**
   * Record cache metrics
   */
  recordCacheHit(cacheKeyPrefix: string) {
    this.cacheHitsTotal.labels(cacheKeyPrefix).inc();
  }

  recordCacheMiss(cacheKeyPrefix: string) {
    this.cacheMissesTotal.labels(cacheKeyPrefix).inc();
  }

  recordCacheOperation(operation: string, cacheKeyPrefix: string, duration: number) {
    this.cacheOperationDuration.labels(operation, cacheKeyPrefix).observe(duration / 1000);
  }

  updateCacheStats(keyCount: number, memoryUsage: number, hitRate: number) {
    this.cacheKeyCount.labels('all').set(keyCount);
    this.cacheMemoryUsage.set(memoryUsage);
    this.cacheHitRate.set(hitRate);
  }

  /**
   * Record rate limiting metrics
   */
  recordRateLimitViolation(userRole: string, endpointCategory: string, source: string) {
    this.rateLimitViolationsTotal.labels(userRole, endpointCategory, source).inc();
  }

  updateBackoffCount(count: number) {
    this.rateLimitBackoffActive.set(count);
  }

  recordWhitelistedRequest(identifier: string) {
    this.rateLimitWhitelistedRequests.labels(identifier).inc();
  }

  updateQuotaUsage(userId: string, quotaType: string, usagePercent: number) {
    this.rateLimitQuotaUsage.labels(userId, quotaType).set(usagePercent);
  }

  /**
   * Record business metrics
   */
  recordUserRegistration() {
    this.usersRegisteredTotal.inc();
  }

  recordOrder(status: string, paymentMethod: string, value: number) {
    this.ordersTotal.labels(status, paymentMethod).inc();
    this.orderValue.labels(status).observe(value);
  }

  recordProductView(productId: string, category: string) {
    this.productsViewed.labels(productId, category).inc();
  }

  updateActiveUsers(count: number) {
    this.usersActive.set(count);
  }

  updateConnectedDevices(count: number) {
    this.devicesConnected.set(count);
  }

  updateActiveSensors(sensorType: string, count: number) {
    this.sensorsActive.labels(sensorType).set(count);
  }

  /**
   * Record API endpoint metrics
   */
  recordApiEndpoint(
    module: string,
    endpoint: string,
    method: string,
    duration: number,
    error?: { type: string },
  ) {
    this.apiEndpointRequests.labels(module, endpoint, method).inc();
    this.apiEndpointDuration.labels(module, endpoint, method).observe(duration);

    if (error) {
      this.apiEndpointErrors.labels(module, endpoint, method, error.type).inc();
    }
  }

  /**
   * Record cart & e-commerce metrics (Phase 7)
   */
  recordCartItemAdded(productId: string, userType: 'guest' | 'authenticated') {
    this.cartItemsAdded.labels(productId, userType).inc();
  }

  recordCartItemRemoved(productId: string, userType: 'guest' | 'authenticated') {
    this.cartItemsRemoved.labels(productId, userType).inc();
  }

  recordCartCheckout(paymentMethod: string, value: number) {
    this.cartCheckoutsTotal.labels(paymentMethod).inc();
    this.cartCheckoutValue.labels(paymentMethod).observe(value);
  }

  recordCartAbandonment(userType: 'guest' | 'authenticated') {
    this.cartAbandonmentTotal.labels(userType).inc();
  }

  updateActiveCarts(userType: 'guest' | 'authenticated', count: number) {
    this.cartActiveCarts.labels(userType).set(count);
  }

  recordShippingCalculation(method: 'STANDARD' | 'EXPRESS' | 'SAME_DAY', region: string) {
    this.shippingCalculations.labels(method, region).inc();
  }

  recordTaxCollected(region: 'NCR' | 'Province', amount: number) {
    this.taxCollected.labels(region).inc(amount);
  }

  recordShippingRevenue(method: 'STANDARD' | 'EXPRESS' | 'SAME_DAY', amount: number) {
    this.shippingRevenue.labels(method).inc(amount);
  }

  /**
   * Get all metrics in Prometheus format
   */
  async getMetrics(): Promise<string> {
    return register.metrics();
  }

  /**
   * Get metrics as JSON (for debugging)
   */
  async getMetricsAsJson() {
    return register.getMetricsAsJSON();
  }

  /**
   * Reset all metrics (useful for testing)
   */
  resetMetrics() {
    register.resetMetrics();
    this.logger.warn('🔄 All Prometheus metrics have been reset');
  }
}
