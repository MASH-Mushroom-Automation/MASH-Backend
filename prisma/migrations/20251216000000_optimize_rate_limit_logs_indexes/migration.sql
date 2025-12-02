-- CreateIndex
CREATE INDEX "idx_identifier_blocked_window" ON "rate_limit_logs"("identifier", "blocked", "windowStart");

-- CreateIndex
CREATE INDEX "idx_identifier_window_range" ON "rate_limit_logs"("identifier", "windowStart", "windowEnd");

-- CreateIndex
CREATE INDEX "idx_endpoint_blocked_window" ON "rate_limit_logs"("endpoint", "blocked", "windowStart");

-- CreateIndex
CREATE INDEX "idx_blocked_created" ON "rate_limit_logs"("blocked", "createdAt");
