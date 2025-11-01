# MASH Backend - Grafana Dashboards

This directory contains pre-built Grafana dashboard templates for monitoring the MASH Backend application.

## 📊 Available Dashboards

### 1. Monitoring Overview (`mash-monitoring-overview.json`)
**UID**: `mash-monitoring-overview`

Comprehensive overview of system performance and health metrics.

**Panels**:
- HTTP Request Rate
- HTTP Response Time (95th percentile)
- HTTP Error Rate with alerts
- Database Query Duration
- Cache Hit Rate
- Active Database Connections
- Memory Usage
- CPU Usage
- Active Alerts by Priority
- Orders by Status
- Auth Attempts (Success vs Failure)
- Rate Limit Violations
- Event Loop Lag with alerts

**Refresh Rate**: 5 seconds

---

### 2. Alerts Dashboard (`mash-alerts-dashboard.json`)
**UID**: `mash-alerts-dashboard`

Dedicated dashboard for alert monitoring and management.

**Panels**:
- Active Alerts Count
- Critical Alerts Count
- Average Resolution Time
- Alerts Triggered Today
- Alerts by Priority (pie chart)
- Alerts by Category (pie chart)
- Alerts by Status (pie chart)
- Alert Trigger Rate
- Alert Resolution Time Trend
- Top 10 Alert Types
- Alert Escalations
- System Health Alerts
- Security Alerts
- Performance Alerts

**Refresh Rate**: 30 seconds

---

### 3. Health Dashboard (`mash-health-dashboard.json`)
**UID**: `mash-health-dashboard`

Real-time system health monitoring with detailed diagnostics.

**Panels**:
- Overall System Health Status
- Database Health Status
- Cache Health Status
- Dependencies Health Status
- Memory Usage (gauge)
- Disk Usage (gauge)
- Database Connection Pool (gauge)
- Memory Usage Over Time
- Disk Space Over Time
- Health Check Response Time
- Dependency Status History (timeline)
- Health Check Failures (table)

**Refresh Rate**: 10 seconds

---

## 🚀 Installation

### Option 1: Import via Grafana UI

1. Open your Grafana instance (default: http://localhost:4000)
2. Login (default credentials: admin/admin)
3. Navigate to **Dashboards** → **Import**
4. Click **Upload JSON file**
5. Select one of the dashboard files:
   - `mash-monitoring-overview.json`
   - `mash-alerts-dashboard.json`
   - `mash-health-dashboard.json`
6. Configure data source (select your Prometheus instance)
7. Click **Import**

### Option 2: Automated Provisioning

Add to your `grafana/provisioning/dashboards/dashboards.yml`:

```yaml
apiVersion: 1

providers:
  - name: 'MASH Dashboards'
    orgId: 1
    folder: 'MASH Backend'
    type: file
    disableDeletion: false
    updateIntervalSeconds: 10
    allowUiUpdates: true
    options:
      path: /etc/grafana/dashboards
```

Then copy dashboard files to the configured path:

```bash
# Docker
docker cp grafana/dashboards/mash-monitoring-overview.json grafana:/etc/grafana/dashboards/
docker cp grafana/dashboards/mash-alerts-dashboard.json grafana:/etc/grafana/dashboards/
docker cp grafana/dashboards/mash-health-dashboard.json grafana:/etc/grafana/dashboards/

# Or mount as volume in docker-compose.yml
volumes:
  - ./grafana/dashboards:/etc/grafana/dashboards
```

### Option 3: Using Docker Compose

Add to your `docker-compose.yml`:

```yaml
services:
  grafana:
    image: grafana/grafana:latest
    ports:
      - "4000:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
      - GF_AUTH_ANONYMOUS_ENABLED=true
    volumes:
      - ./grafana/dashboards:/var/lib/grafana/dashboards
      - ./grafana/provisioning:/etc/grafana/provisioning
    networks:
      - monitoring
```

---

## 📖 Dashboard Details

### Metrics Source

All dashboards query metrics from the MASH Backend Prometheus endpoint:
- **URL**: `http://localhost:3000/metrics`
- **Scrape Interval**: 15 seconds (configured in Prometheus)

### Alert Rules

The dashboards include built-in alert rules:

#### High Error Rate Alert
- **Trigger**: HTTP error rate > 10% for 5 minutes
- **Severity**: Critical
- **Dashboard**: Monitoring Overview

#### High Event Loop Lag Alert
- **Trigger**: Event loop lag > 100ms for 5 minutes
- **Severity**: Warning
- **Dashboard**: Monitoring Overview

### Thresholds

| Metric | Green | Yellow | Red |
|--------|-------|--------|-----|
| Cache Hit Rate | >90% | 70-90% | <70% |
| DB Connections | <8 | 8-10 | >10 |
| Memory Usage | <512MB | 512MB-1GB | >1GB |
| CPU Usage | <70% | 70-90% | >90% |
| Disk Usage | <80% | 80-90% | >90% |
| Memory Heap | <70% | 70-90% | >90% |
| Avg Resolution Time | <1h | 1h-2h | >2h |

---

## 🎨 Customization

### Modify Time Range

Each dashboard has a default time range. To change:

1. Open dashboard in Grafana
2. Click time picker (top right)
3. Select predefined range or custom range
4. Click **Save dashboard** to persist

### Add New Panels

1. Open dashboard
2. Click **Add panel** button
3. Select visualization type
4. Configure query (PromQL):
   ```promql
   # Example: Custom metric query
   rate(mash_custom_metric_total[5m])
   ```
5. Configure display settings
6. Click **Apply**
7. Click **Save dashboard**

### Change Refresh Rate

1. Open dashboard settings (gear icon)
2. Find **Auto refresh** section
3. Select desired interval or add custom
4. Click **Save**

---

## 🔍 Querying Metrics

### Example PromQL Queries

#### HTTP Metrics
```promql
# Request rate
rate(mash_http_requests_total[5m])

# Response time (95th percentile)
histogram_quantile(0.95, rate(mash_http_response_time_ms_bucket[5m]))

# Error rate
rate(mash_http_requests_total{status_code=~"5.."}[5m])
```

#### Database Metrics
```promql
# Query duration
histogram_quantile(0.95, rate(mash_db_query_duration_ms_bucket[5m]))

# Active connections
mash_db_pool_active_connections

# Failed queries
rate(mash_db_query_failures_total[5m])
```

#### Cache Metrics
```promql
# Hit rate
sum(rate(mash_cache_hits_total[5m])) / (sum(rate(mash_cache_hits_total[5m])) + sum(rate(mash_cache_misses_total[5m]))) * 100

# Operations per second
rate(mash_cache_operations_total[5m])
```

#### Alert Metrics
```promql
# Active alerts
sum(mash_alerts_active)

# Alerts by priority
sum by (priority) (mash_alerts_active)

# Alert trigger rate
rate(mash_alerts_triggered_total[5m])
```

#### Health Metrics
```promql
# System health status
mash_health_status{service="overall"}

# Memory usage percentage
mash_health_memory_heap_percent

# Disk usage percentage
mash_health_disk_used_percent
```

---

## 📱 Mobile View

All dashboards are responsive and mobile-friendly:

1. Access Grafana on mobile browser
2. Navigate to dashboard
3. Panels automatically adjust to screen size
4. Use pinch-to-zoom for detailed views

---

## 🔔 Setting Up Alerts

### Configure Alert Channels

1. Navigate to **Alerting** → **Notification channels**
2. Click **Add channel**
3. Configure:
   - **Name**: e.g., "Slack Alerts"
   - **Type**: Slack, Email, PagerDuty, etc.
   - **Settings**: API key, webhook URL, etc.
4. Test notification
5. Click **Save**

### Link Alerts to Channels

1. Open dashboard with alert rules
2. Edit panel with alert
3. Navigate to **Alert** tab
4. Under **Notifications**, select channel
5. Configure notification message
6. Click **Apply** and **Save dashboard**

---

## 📊 Dashboard Links

### Quick Access URLs
- **Monitoring Overview**: `http://localhost:4000/d/mash-monitoring-overview`
- **Alerts Dashboard**: `http://localhost:4000/d/mash-alerts-dashboard`
- **Health Dashboard**: `http://localhost:4000/d/mash-health-dashboard`

---

## 🐛 Troubleshooting

### Dashboard shows "No Data"

**Cause**: Prometheus not scraping metrics

**Solutions**:
1. Verify Prometheus is running: `curl http://localhost:9090/targets`
2. Check scrape config in `prometheus.yml`
3. Verify backend is exposing metrics: `curl http://localhost:3000/metrics`
4. Restart Prometheus: `docker restart prometheus`

### Queries are slow

**Cause**: Long time range or high cardinality metrics

**Solutions**:
1. Reduce time range
2. Increase scrape interval
3. Add recording rules in Prometheus
4. Optimize queries with aggregation

### Alerts not triggering

**Cause**: Alert rule misconfiguration

**Solutions**:
1. Check alert expression is valid
2. Verify evaluation interval
3. Test query in Explore tab
4. Check notification channel is configured

---

## 📚 Additional Resources

- [Grafana Documentation](https://grafana.com/docs/)
- [PromQL Guide](https://prometheus.io/docs/prometheus/latest/querying/basics/)
- [Prometheus Best Practices](https://prometheus.io/docs/practices/)
- [MASH Backend Monitoring Guide](../../docs/monitoring/MONITORING_GUIDE.md)

---

## 🤝 Contributing

To add or modify dashboards:

1. Make changes in Grafana UI
2. Export dashboard JSON (Share → Export → Save to file)
3. Save to `grafana/dashboards/`
4. Update this README with changes
5. Commit and create pull request

---

**Last Updated**: November 2, 2025  
**Dashboards Version**: 1.0.0  
**Compatible Backend Version**: 1.x.x
