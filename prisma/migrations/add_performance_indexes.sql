-- Phase 1 Performance Optimization: Strategic Database Indexes
-- Task 1.2: Database Indexing Strategy
-- Issue #24 - Performance Optimization & Caching Backend

-- ============================================================================
-- PRODUCTS MODULE - High Traffic (E-commerce)
-- ============================================================================

-- Product listing and search (most common query)
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_products_active_featured_created"
  ON "products" ("isActive", "isFeatured", "createdAt" DESC)
  WHERE "isActive" = true;

-- Product search by category
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_products_categories_gin"
  ON "products" USING GIN ("categories");

-- Product search by tags
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_products_tags_gin"
  ON "products" USING GIN ("tags");

-- Product inventory management
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_products_stock_minstock"
  ON "products" ("stock", "minStock")
  WHERE "stock" <= "minStock";

-- Product slug lookup (unique but good for performance)
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_products_slug_active"
  ON "products" ("slug", "isActive");

-- ============================================================================
-- ORDERS MODULE - Critical for Business
-- ============================================================================

-- User order history
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_orders_user_status_created"
  ON "orders" ("userId", "status", "createdAt" DESC);

-- Order tracking and fulfillment
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_orders_status_created"
  ON "orders" ("status", "createdAt" DESC)
  WHERE "status" IN ('PENDING', 'CONFIRMED', 'PROCESSING');

-- Order search by number
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_orders_ordernumber"
  ON "orders" ("orderNumber");

-- ============================================================================
-- SENSOR DATA - Time-Series Data (IoT)
-- ============================================================================

-- Sensor data queries by sensor and time
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_sensor_data_sensor_timestamp"
  ON "sensor_data" ("sensorId", "timestamp" DESC);

-- Sensor data queries by type and time (already exists, verify)
-- This should already exist: @@index([type, timestamp])

-- User's sensor data history
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_sensor_data_user_timestamp"
  ON "sensor_data" ("userId", "timestamp" DESC);

-- Real-time monitoring (recent data)
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_sensor_data_device_recent"
  ON "sensor_data" ("deviceId", "timestamp" DESC)
  WHERE "timestamp" > NOW() - INTERVAL '24 hours';

-- ============================================================================
-- ALERTS MODULE - Real-time Notifications
-- ============================================================================

-- Active alerts by priority
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_alerts_status_priority_triggered"
  ON "alerts" ("status", "priority", "triggeredAt" DESC)
  WHERE "status" IN ('PENDING', 'SENT', 'ACKNOWLEDGED');

-- Alert search by event type
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_alerts_event_type_triggered"
  ON "alerts" ("eventType", "triggeredAt" DESC);

-- Alert deduplication
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_alerts_fingerprint_status"
  ON "alerts" ("fingerprint", "status");

-- ============================================================================
-- NOTIFICATIONS MODULE - Delivery Tracking
-- ============================================================================

-- User notifications (inbox)
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_notifications_user_status_created"
  ON "notifications" ("userId", "status", "createdAt" DESC)
  WHERE "userId" IS NOT NULL;

-- Notification queue processing
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_notifications_queue_priority"
  ON "notifications" ("status", "priority", "queuedAt")
  WHERE "status" IN ('PENDING', 'QUEUED', 'RETRYING');

-- Failed notifications for retry
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_notifications_retry"
  ON "notifications" ("status", "nextRetryAt")
  WHERE "status" = 'RETRYING' AND "nextRetryAt" IS NOT NULL;

-- ============================================================================
-- USERS MODULE - Authentication & Profile
-- ============================================================================

-- Active user lookup
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_users_active_role"
  ON "users" ("isActive", "role")
  WHERE "isActive" = true;

-- User last login
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_users_last_login"
  ON "users" ("lastLoginAt" DESC NULLS LAST)
  WHERE "isActive" = true;

-- ============================================================================
-- SESSIONS MODULE - Active Sessions
-- ============================================================================

-- Active sessions cleanup
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_sessions_expires_status"
  ON "sessions" ("expiresAt", "status")
  WHERE "status" = 'ACTIVE';

-- User active sessions
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_sessions_user_status_activity"
  ON "sessions" ("userId", "status", "lastActivity" DESC);

-- ============================================================================
-- DEVICES MODULE - IoT Device Management
-- ============================================================================

-- User devices by status
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_devices_user_status_active"
  ON "devices" ("userId", "status", "isActive");

-- Device health monitoring
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_devices_status_lastseen"
  ON "devices" ("status", "lastSeen" DESC)
  WHERE "isActive" = true;

-- ============================================================================
-- AUDIT LOGS - Compliance & Security
-- ============================================================================

-- Audit log search by entity
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_audit_logs_entity_entityid_timestamp"
  ON "audit_logs" ("entity", "entityId", "timestamp" DESC);

-- User activity audit
-- Already exists: @@index([userId, timestamp])

-- ============================================================================
-- SECURITY LOGS - Security Monitoring
-- ============================================================================

-- Security event monitoring
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_security_logs_severity_timestamp"
  ON "security_logs" ("severity", "timestamp" DESC);

-- Security event search
-- Already exists: @@index([event])

-- ============================================================================
-- CATEGORIES MODULE - Product Organization
-- ============================================================================

-- Active categories by sort order
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_categories_active_sort"
  ON "categories" ("isActive", "sortOrder")
  WHERE "isActive" = true;

-- Category hierarchy
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_categories_parent_active"
  ON "categories" ("parentId", "isActive")
  WHERE "parentId" IS NOT NULL;

-- ============================================================================
-- PERFORMANCE NOTES
-- ============================================================================

-- CONCURRENTLY: Allows table to be read/written during index creation
-- GIN indexes: For JSONB columns (categories, tags) - faster for array operations
-- Partial indexes: WHERE clauses reduce index size and improve performance
-- Composite indexes: Order matters! Put most selective column first

-- ============================================================================
-- INDEX MONITORING QUERIES
-- ============================================================================

-- Check index usage
-- SELECT schemaname, tablename, indexname, idx_scan, idx_tup_read, idx_tup_fetch
-- FROM pg_stat_user_indexes
-- ORDER BY idx_scan DESC;

-- Check index size
-- SELECT indexname, pg_size_pretty(pg_relation_size(indexrelid))
-- FROM pg_stat_user_indexes
-- WHERE schemaname = 'public'
-- ORDER BY pg_relation_size(indexrelid) DESC;

-- Find missing indexes
-- SELECT schemaname, tablename, seq_scan, seq_tup_read,
--        idx_scan, idx_tup_fetch,
--        seq_tup_read / seq_scan AS avg_seq_tup_read
-- FROM pg_stat_user_tables
-- WHERE seq_scan > 0
-- ORDER BY seq_tup_read DESC;
