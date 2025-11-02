#!/usr/bin/env node
/**
 * Startup wrapper with timeout for CI environments
 * Kills the app if it doesn't start within the specified timeout
 */

const { spawn } = require('child_process');
const fs = require('fs');

const STARTUP_TIMEOUT = 60000; // 60 seconds
const startTime = Date.now();

console.log('🚀 Starting application with timeout wrapper...');
console.log(`⏱️  Timeout: ${STARTUP_TIMEOUT / 1000}s`);

// Start the application
const app = spawn('node', ['dist/main.js'], {
  stdio: ['inherit', 'pipe', 'pipe'],
  env: { ...process.env }
});

let appStarted = false;
let startupComplete = false;

// Timeout handler
const timeoutId = setTimeout(() => {
  if (!startupComplete) {
    const elapsed = Math.round((Date.now() - startTime) / 1000);
    console.error(`\n❌ STARTUP TIMEOUT after ${elapsed}s`);
    console.error('The application did not complete initialization within the timeout period.');
    console.error('This usually indicates a blocking operation in module initialization.');
    console.error('\nCommon causes:');
    console.error('  - Elasticsearch trying to connect');
    console.error('  - MQTT broker connection timeout');
    console.error('  - Redis connection hanging');
    console.error('  - Database migration stuck');
    console.error('  - External API call during startup');
    
    console.error('\n🔪 Killing application process...');
    app.kill('SIGKILL');
    process.exit(1);
  }
}, STARTUP_TIMEOUT);

// Watch stdout for startup completion
app.stdout.on('data', (data) => {
  const output = data.toString();
  process.stdout.write(output);
  
  // Look for bootstrap completion indicators
  if (output.includes('Nest application successfully started') ||
      output.includes('Application is running on') ||
      output.includes('server listening on port') ||
      output.includes('Stage 7 complete: All stages completed')) {
    appStarted = true;
    
    if (!startupComplete) {
      const elapsed = Math.round((Date.now() - startTime) / 1000);
      console.log(`\n✅ Application started successfully in ${elapsed}s`);
      startupComplete = true;
      clearTimeout(timeoutId);
    }
  }
  
  // Detect stuck stages
  if (output.includes('Stage 1: Creating NestJS application')) {
    setTimeout(() => {
      if (!appStarted) {
        const elapsed = Math.round((Date.now() - startTime) / 1000);
        console.warn(`\n⚠️  Application stuck at Stage 1 for ${elapsed}s`);
        console.warn('If this persists, check for blocking operations in:');
        console.warn('  - AppModule imports');
        console.warn('  - Service constructors');
        console.warn('  - onModuleInit hooks');
      }
    }, 20000); // Warn after 20s
  }
});

// Watch stderr
app.stderr.on('data', (data) => {
  process.stderr.write(data);
});

// Handle app exit
app.on('close', (code) => {
  clearTimeout(timeoutId);
  const elapsed = Math.round((Date.now() - startTime) / 1000);
  
  if (!appStarted) {
    console.error(`\n❌ Application exited before completing startup (after ${elapsed}s)`);
    process.exit(code || 1);
  } else {
    console.log(`\nApplication process exited with code ${code} after ${elapsed}s`);
    process.exit(code);
  }
});

// Handle wrapper signals
process.on('SIGINT', () => {
  console.log('\n📡 Received SIGINT, forwarding to app...');
  app.kill('SIGINT');
});

process.on('SIGTERM', () => {
  console.log('\n📡 Received SIGTERM, forwarding to app...');
  app.kill('SIGTERM');
});
