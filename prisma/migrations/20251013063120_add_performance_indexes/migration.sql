-- CreateIndex
CREATE INDEX "categories_isActive_sortOrder_idx" ON "categories"("isActive", "sortOrder");

-- CreateIndex
CREATE INDEX "categories_parentId_isActive_idx" ON "categories"("parentId", "isActive");

-- CreateIndex
CREATE INDEX "categories_createdAt_idx" ON "categories"("createdAt");

-- CreateIndex
CREATE INDEX "devices_userId_status_isActive_idx" ON "devices"("userId", "status", "isActive");

-- CreateIndex
CREATE INDEX "devices_status_lastSeen_idx" ON "devices"("status", "lastSeen" DESC);

-- CreateIndex
CREATE INDEX "devices_createdAt_idx" ON "devices"("createdAt");

-- CreateIndex
CREATE INDEX "devices_isActive_idx" ON "devices"("isActive");

-- CreateIndex
CREATE INDEX "notifications_userId_status_createdAt_idx" ON "notifications"("userId", "status", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "notifications_status_priority_queuedAt_idx" ON "notifications"("status", "priority", "queuedAt");

-- CreateIndex
CREATE INDEX "notifications_status_nextRetryAt_idx" ON "notifications"("status", "nextRetryAt");

-- CreateIndex
CREATE INDEX "orders_userId_status_createdAt_idx" ON "orders"("userId", "status", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "orders_status_createdAt_idx" ON "orders"("status", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "orders_orderNumber_idx" ON "orders"("orderNumber");

-- CreateIndex
CREATE INDEX "orders_createdAt_idx" ON "orders"("createdAt");

-- CreateIndex
CREATE INDEX "orders_deliveredAt_idx" ON "orders"("deliveredAt");

-- CreateIndex
CREATE INDEX "products_isActive_isFeatured_createdAt_idx" ON "products"("isActive", "isFeatured", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "products_slug_isActive_idx" ON "products"("slug", "isActive");

-- CreateIndex
CREATE INDEX "products_stock_minStock_idx" ON "products"("stock", "minStock");

-- CreateIndex
CREATE INDEX "products_createdAt_idx" ON "products"("createdAt");

-- CreateIndex
CREATE INDEX "system_config_category_isPublic_idx" ON "system_config"("category", "isPublic");

-- CreateIndex
CREATE INDEX "system_config_key_isPublic_idx" ON "system_config"("key", "isPublic");

-- CreateIndex
CREATE INDEX "users_createdAt_idx" ON "users"("createdAt");

-- CreateIndex
CREATE INDEX "users_isActive_role_idx" ON "users"("isActive", "role");

-- CreateIndex
CREATE INDEX "users_lastLoginAt_idx" ON "users"("lastLoginAt");
