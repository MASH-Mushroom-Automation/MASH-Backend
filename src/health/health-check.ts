/**
 * Simple health-check script used by Docker HEALTHCHECK.
 * It performs an HTTP GET against the running application's health endpoint
 * and exits with code 0 on success (2xx), non-zero otherwise.
 *
 * This file is compiled to `dist/health-check.js` by `npm run build` and
 * referenced by the Dockerfile HEALTHCHECK instruction.
 */
import http from 'http';

const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;
const PATH = process.env.HEALTH_PATH || '/api/v1/health';
const HOST = process.env.HEALTH_HOST || '127.0.0.1';
const TIMEOUT_MS = 10000; // Increased to 10 seconds for cold starts

function checkHealth(): Promise<number> {
  const url = `http://${HOST}:${PORT}${PATH}`;

  return new Promise(resolve => {
    const req = http.get(url, res => {
      const ok = res.statusCode && res.statusCode >= 200 && res.statusCode < 300;
      res.resume();
      resolve(ok ? 0 : 1);
    });

    req.on('error', err => {
      console.error(`Health check request error: ${err.message}`);
      resolve(1);
    });
    req.setTimeout(TIMEOUT_MS, () => {
      console.error(`Health check timeout after ${TIMEOUT_MS}ms`);
      req.destroy();
      resolve(1);
    });
  });
}

(async () => {
  const code = await checkHealth();
  // Health check script needs console for Docker output
  // This is an exception to the no-console rule
  if (code === 0) {
    // eslint-disable-next-line no-console
    console.log(`✅ Health check passed: ${HOST}:${PORT}${PATH}`);
    process.exit(0);
  }

  console.error(`❌ Health check failed: ${HOST}:${PORT}${PATH}`);
  process.exit(1);
})().catch((error: Error) => {
  console.error(`Health check error: ${error.message}`);
  process.exit(1);
});
