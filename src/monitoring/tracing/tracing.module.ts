import { Module, Global } from '@nestjs/common';
import { TracingService } from './tracing.service';

/**
 * TracingModule - OpenTelemetry Distributed Tracing Module
 *
 * This module provides the TracingService for creating custom spans
 * throughout the application.
 *
 * Note: The OpenTelemetry SDK is initialized in src/tracing.ts,
 * which must be imported BEFORE the NestJS application is created.
 * This module only provides utilities for creating custom spans.
 */
@Global()
@Module({
  providers: [TracingService],
  exports: [TracingService],
})
export class TracingModule {}
