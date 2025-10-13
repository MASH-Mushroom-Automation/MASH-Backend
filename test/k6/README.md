# MASH Backend - Load Testing Quick Start

**Last Updated**: October 12, 2025  
**Phase**: 5 - Load Testing & Benchmarking

---

## 🚀 Quick Start (5 Minutes)

### Prerequisites

1. **Install k6**:
   ```powershell
   winget install k6
   ```

2. **Start Backend**:
   ```powershell
   npm run start:dev
   # Or with Docker:
   docker-compose up -d
   ```

3. **Verify Backend**:
   ```powershell
   curl http://localhost:3000/health
   # Should return: {"status":"ok"}
   ```

---

## 🧪 Run Tests

### Option 1: Run All Tests (Recommended)

```powershell
# Runs all 3 tests in sequence (~50 minutes total)
.\test\k6\run-all-tests.bat
```

This will execute:
1. **Smoke Test** (5 min) - Quick validation
2. **Load Test** (20 min) - Production simulation  
3. **Stress Test** (25 min) - Breaking point analysis

### Option 2: Run Individual Tests

#### Smoke Test (5 minutes)
```powershell
k6 run test\k6\scenarios\smoke.js
```
- **Purpose**: Verify all endpoints work
- **VUs**: 1-10
- **Expected**: All endpoints respond, no errors

#### Load Test (20 minutes)
```powershell
k6 run test\k6\scenarios\load.js
```
- **Purpose**: Simulate production load
- **VUs**: 1-300  
- **Expected**: P95 <200ms, error <1%, cache hit >80%

#### Stress Test (25 minutes)
```powershell
k6 run test\k6\scenarios\stress.js
```
- **Purpose**: Find breaking point
- **VUs**: 1-1500
- **Expected**: System degradation analysis

### Option 3: Run Specific API Tests

```powershell
# Test Products API only
k6 run test\k6\tests\products.test.js

# Test Orders API only
k6 run test\k6\tests\orders.test.js

# Test Analytics API only
k6 run test\k6\tests\analytics.test.js

# Test Devices/Sensors API only
k6 run test\k6\tests\devices.test.js
```

---

## 📊 Understanding Results

### Terminal Output

k6 will display real-time metrics:

```
✓ http_req_duration..............: avg=85ms  min=12ms med=65ms max=450ms p(90)=150ms p(95)=180ms
✓ http_req_failed................: 0.42% (21 of 5000)
✓ http_reqs......................: 5000  312.5/s
✓ cache_hit_rate.................: 87.3% (4365 of 5000)
```

### Success Criteria

| Metric | Smoke Test | Load Test | Stress Test |
|--------|------------|-----------|-------------|
| **P95 Latency** | <300ms ✅ | <200ms ✅ | <500ms ⚠️ |
| **Error Rate** | <5% ✅ | <1% ✅ | <5% ⚠️ |
| **Throughput** | 50+ req/s | 300+ req/s | 500+ req/s |
| **Cache Hit** | N/A | >80% ✅ | >75% ⚠️ |

✅ = Must pass  
⚠️ = Degradation expected at high load

### Result Files

Test results are saved to:
```
test/k6/results/
├── smoke-results.json
├── load-results.json
└── stress-results.json
```

---

## 📈 Monitoring During Tests

### 1. Grafana Dashboards

Open http://localhost:3001 and watch:

- **API Performance Dashboard**: Request rate, latency, errors
- **Database Performance Dashboard**: Query duration, connection pool
- **Trace Analytics Dashboard**: Distributed traces
- **Business Metrics Dashboard**: Orders, revenue, devices

### 2. Prometheus Metrics

Open http://localhost:9090 and query:

```promql
# Request rate
rate(http_requests_total[1m])

# P95 latency
histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[1m]))

# Cache hit rate
rate(cache_hits_total[1m]) / rate(cache_operations_total[1m])

# Error rate
rate(http_requests_total{status=~"5.."}[1m])
```

### 3. Jaeger Traces

Open http://localhost:16686 to:

- View individual request traces
- Identify slow spans (database, cache, external APIs)
- Analyze error traces
- See service dependency graph

---

## 🔧 Test Configuration

### Environment Variables

Set custom configuration:

```powershell
# Custom base URL
$env:BASE_URL="http://localhost:3000"

# Run load test with custom URL
k6 run test\k6\scenarios\load.js
```

### Custom Test Duration

```powershell
# Quick 2-minute load test
k6 run --vus 100 --duration 2m test\k6\scenarios\load.js

# Extended 1-hour soak test
k6 run --vus 200 --duration 1h test\k6\scenarios\load.js
```

### Custom VU Count

```powershell
# Light load (50 VUs)
k6 run --vus 50 --duration 5m test\k6\scenarios\load.js

# Heavy load (500 VUs)
k6 run --vus 500 --duration 10m test\k6\scenarios\stress.js
```

---

## 🎯 What to Look For

### Good Performance ✅

- P95 latency: <200ms
- Error rate: <1%
- Cache hit rate: >80%
- No database connection exhaustion
- No memory leaks (stable over time)
- Fast recovery after load spikes

### Performance Issues ⚠️

- P95 latency: >300ms
- Error rate: >2%
- Cache hit rate: <70%
- Database connection pool saturation
- Increasing response times over time
- Slow recovery after load spikes

### Critical Issues ❌

- P95 latency: >1000ms
- Error rate: >5%
- Service crashes or restarts
- Database connection failures
- Out of memory errors
- Request timeouts

---

## 🐛 Troubleshooting

### Issue: Backend not responding

```powershell
# Check if backend is running
curl http://localhost:3000/health

# Start backend
npm run start:dev

# Check logs
npm run start:dev | findstr "ERROR"
```

### Issue: High error rate during tests

1. Check backend logs for errors
2. Review Grafana dashboards for bottlenecks
3. Check database connection pool usage
4. Verify Redis is running
5. Check rate limiting thresholds

### Issue: Tests timing out

```powershell
# Increase test timeout (default: 30s)
k6 run --http-timeout 60s test\k6\scenarios\load.js
```

### Issue: k6 not found

```powershell
# Install k6
winget install k6

# Verify installation
k6 version
```

### Issue: Connection refused

```powershell
# Check if port 3000 is in use
netstat -ano | findstr :3000

# Kill process if needed (replace <PID>)
taskkill /PID <PID> /F
```

---

## 📚 Additional Resources

### Documentation

- [Phase 5 Completion Guide](../documents/PHASE_5_LOAD_TESTING_COMPLETION.md)
- [Project Completion Summary](../documents/PROJECT_COMPLETION_SUMMARY.md)
- [Monitoring Quick Start](../MONITORING_QUICK_START.md)

### k6 Resources

- [k6 Documentation](https://k6.io/docs/)
- [k6 Thresholds](https://k6.io/docs/using-k6/thresholds/)
- [k6 Metrics](https://k6.io/docs/using-k6/metrics/)
- [k6 Options](https://k6.io/docs/using-k6/k6-options/)

### Grafana Resources

- [Grafana Documentation](https://grafana.com/docs/)
- [Prometheus Queries](https://prometheus.io/docs/prometheus/latest/querying/basics/)
- [Jaeger Tracing](https://www.jaegertracing.io/docs/)

---

## 🎉 Success Checklist

After running tests, verify:

- [ ] Smoke test passed (all endpoints responding)
- [ ] Load test met thresholds (P95 <200ms, error <1%)
- [ ] Stress test identified breaking point (>500 req/s)
- [ ] Cache hit rate >80% during load test
- [ ] No critical errors in backend logs
- [ ] Grafana dashboards show healthy metrics
- [ ] Jaeger traces show reasonable request flows
- [ ] Result JSON files generated successfully

---

## 📞 Support

For issues or questions:

1. Check [Troubleshooting](#troubleshooting) section above
2. Review [Phase 5 Documentation](../documents/PHASE_5_LOAD_TESTING_COMPLETION.md)
3. Check backend logs: `npm run start:dev`
4. Review Grafana dashboards: http://localhost:3001

---

**Happy Load Testing! 🚀**
