/**
 * OpenTelemetry Tracing Configuration
 *
 * This file initializes OpenTelemetry tracing for the MASH Backend.
 * It must be imported before any other application code.
 *
 * Features:
 * - Auto-instrumentation for HTTP, Express, NestJS
 * - Custom spans for business operations
 * - Trace context propagation
 * - Export to Jaeger/Zipkin/OTLP collectors
 *
 * Usage:
 * Import this file at the top of main.ts:
 * import './tracing';
 */

import { Logger } from '@nestjs/common';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base';

// Logger for tracing initialization
const logger = new Logger('OpenTelemetry');

// Configuration from environment variables
const OTEL_ENABLED = process.env.OTEL_ENABLED === 'true';
const OTEL_EXPORTER_OTLP_ENDPOINT =
  process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318/v1/traces';
const OTEL_SERVICE_NAME = process.env.OTEL_SERVICE_NAME || 'mash-backend';
const OTEL_SERVICE_VERSION = process.env.npm_package_version || '1.0.0';
const OTEL_ENVIRONMENT = process.env.NODE_ENV || 'development';

// Only initialize if explicitly enabled
if (!OTEL_ENABLED) {
  logger.warn(
    '⚠️  OpenTelemetry tracing is DISABLED. Set OTEL_ENABLED=true to enable.',
  );
} else {
  logger.log('🔍 Initializing OpenTelemetry tracing...');

  // Create OTLP trace exporter
  const traceExporter = new OTLPTraceExporter({
    url: OTEL_EXPORTER_OTLP_ENDPOINT,
    headers: {}, // Add authentication headers if needed
  });

  // Initialize the SDK with auto-instrumentations
  const sdk = new NodeSDK({
    serviceName: OTEL_SERVICE_NAME,
    spanProcessor: new BatchSpanProcessor(traceExporter, {
      maxQueueSize: 1000,
      maxExportBatchSize: 512,
      scheduledDelayMillis: 5000, // Export every 5 seconds
      exportTimeoutMillis: 30000, // 30 second timeout
    }),
    instrumentations: [
      getNodeAutoInstrumentations({
        // Customize auto-instrumentation
        '@opentelemetry/instrumentation-http': {
          enabled: true,
        },
        '@opentelemetry/instrumentation-express': {
          enabled: true,
        },
        '@opentelemetry/instrumentation-nestjs-core': {
          enabled: true,
        },
        // Disable instrumentations we don't need
        '@opentelemetry/instrumentation-fs': {
          enabled: false,
        },
        '@opentelemetry/instrumentation-dns': {
          enabled: false,
        },
      }),
    ],
  });

  // Start the SDK
  try {
    sdk.start();
    logger.log('✅ OpenTelemetry tracing initialized successfully');
    logger.log(`   Service: ${OTEL_SERVICE_NAME}`);
    logger.log(`   Version: ${OTEL_SERVICE_VERSION}`);
    logger.log(`   Environment: ${OTEL_ENVIRONMENT}`);
    logger.log(`   Exporter: ${OTEL_EXPORTER_OTLP_ENDPOINT}`);
  } catch (error) {
    logger.error('❌ Failed to initialize OpenTelemetry:', error);
  }

  // Graceful shutdown
  process.on('SIGTERM', () => {
    sdk
      .shutdown()
      .then(
        () => logger.log('🔍 OpenTelemetry tracing shut down successfully'),
        (err) => logger.error('❌ Error shutting down OpenTelemetry:', err),
      )
      .finally(() => process.exit(0));
  });
}

export default OTEL_ENABLED;
