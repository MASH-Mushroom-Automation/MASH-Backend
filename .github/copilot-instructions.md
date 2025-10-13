## MASH-Backend — Quick instructions for AI coding agents

Purpose: give an AI agent the minimum, high-value context to be productive immediately in this repo.

  - NestJS monolith split into feature modules under `src/modules/*` (e.g. `orders`, `products`, `users`). Entry point: `src/main.ts`, root wiring: `src/app.module.ts`.
  - Database: Prisma + PostgreSQL. Prisma client init and lifecycle in `src/database/prisma.service.ts` and migrations/seeds under `prisma/`.
  - Cache/coordination: Redis via `src/database/redis.service.ts`. Custom rate-limiter uses `src/common/storage/redis-throttler.storage.ts`.
  - Observability: Prometheus metrics in `src/monitoring/prometheus/*` (metrics path `/metrics`) and OpenTelemetry tracing (`src/monitoring/tracing.ts`).
  - Real-time: Socket.IO WebSocket module in `src/modules/websocket` (namespace configured by `WS_NAMESPACE` in `.env`).

  - Install: `npm install` (see `package.json`).
  - Start (dev): `npm run start:dev` (watch). Production build: `npm run build` then `npm run start:prod`.
  - Debugging: `npm run start:debug` (Nest debug) and `npm run test:debug` for Jest debugging.
  - Tests: unit `npm run test` (look for `*.spec.ts`), integration/e2e `npm run test:e2e` (config `test/jest-e2e.json`). Coverage: `npm run test:cov`.
  - Prisma: `npx prisma generate`, `npm run db:migrate` (dev), `npm run db:push`, `npm run db:seed`.
  - Postman/newman: `npm run postman:test` (uses `postman/00-Master-Complete-API-Collection.postman_collection.json`). CI runs many `npx newman` jobs; the app must be reachable at port 3000.
  - Local infra: review `docker-compose.dev.yml` / `docker-compose.yml` for local Postgres/Redis/Grafana/Prometheus stacks.
  - Load tests: `test/k6/` (see `test/k6/README.md`). `.env` includes a helper note: run `test\k6\run-all-tests.bat` on Windows.

  - Module-per-feature pattern: controller/service/module per feature in `src/modules/*`.
  - Prisma instrumentation: `PrismaService` logs slow queries and exposes `getQueryStats()` and `executeTransaction()` helpers — prefer these helpers for transactional work.
  - RedisService wrapper: prefer `RedisService` methods (`get`, `set`, `increment`, `getTTL`) over raw Redis client access.
  - Throttling: global `CustomThrottlerGuard` configured in `AppModule`; uses `RedisThrottlerStorage` for distributed limits.
  - Test naming: unit tests end with `.spec.ts`; integration tests use `.int-spec.ts` or e2e config.
  - Alias mapping in Jest: `@/` → `src/` (see `package.json` `jest.moduleNameMapper`). Keep imports consistent with those aliases.

  - PostgreSQL (DATABASE_URL in `.env`) — migrations will be applied in CI via `npx prisma migrate deploy`.
  - Redis (REDIS_URL) — feature behavior may degrade to in-memory fallbacks when missing; tests/CI expect Redis service present.
  - Third-party integrations: Firebase, SendGrid, Twilio, Clerk — credentials live in `.env` and must not be committed.

  - Authentication & guards: `src/modules/auth/*` and `src/modules/auth/guards`.
  - Background jobs/queues: `src/modules/queues` and Bull boards under `@nestjs/bull` usage.
  - Observability hooks: `src/monitoring/prometheus/*` and `src/monitoring/tracing*`.

  - CI workflow: `.github/workflows/ci.yml` — it runs lint, tests, Prisma generate/migrate deploy, Newman's Postman collections, and Docker image builds.
  - CI expects the app to respond at `http://localhost:3000/api/v1/health` during API tests — keep health endpoints stable when modifying startup.

  - Never add secrets to repo files. Use `.env` locally or CI secrets; reference `.env` but do not commit changes with secrets.
  - Preserve existing public APIs (controllers and DTOs) unless updating tests and Postman collections. CI and Postman expect stable endpoints.
  - When modifying DB schema: update Prisma schema, run `npx prisma migrate dev` locally, and update seeds `prisma/seed.ts` if needed.

If anything above is unclear or you want me to expand an area (example controllers, a typical PR checklist, or recommended tests to add), tell me which part to expand and I will iterate.

---

## Production deployment & infrastructure notes

- Docker: multi-stage optimized Dockerfile is at `Dockerfile`. It builds with `npm ci` then `npm run build` and expects `dist/health-check.js` (we add a small health-check script at `src/health/health-check.ts`). The HEALTHCHECK runs `node dist/health-check.js`.

- Build & run locally (recommended): build with Docker and run with the provided compose file for local infra:
  - Build image: `docker build -t mash-backend/api:local .`
  - Run with compose (Postgres + Redis + Prometheus): `docker compose -f docker-compose.dev.yml up --build`

- CI/CD: `.github/workflows/ci.yml` runs lint, tests, Prisma generate/migrate, Newman Postman collections and a Docker build/push step. CI expects the app to be reachable at `http://localhost:3000/api/v1/health` while running Postman tests.

- Monitoring & logging: Prometheus metrics are exposed under `/metrics` (see `src/monitoring/prometheus`); traces are exported via OpenTelemetry (`src/monitoring/tracing.ts`) to the endpoint configured by `OTEL_EXPORTER_OTLP_ENDPOINT`.

- Health & recovery: use `src/health/health.controller.ts` for HTTP health endpoints. The Docker health-check is lightweight and should return 0 when `/api/v1/health` responds 2xx. When changing the health endpoints, update `Dockerfile` and CI health checks accordingly.

- Rollbacks & releases: CI builds and pushes images only from `main`/`develop` branches (`docker-build` job). Review tags and metadata in `.github/workflows/ci.yml` before changing image naming/tagging behavior.

If you want, I can:
- Add a small README under `docs/` with exact docker-compose commands and a troubleshooting checklist for common infra failures (DB migrations, Redis down, failed Newman tests).
- Open a PR with these changes and include the health-check script in the build pipeline validation.
