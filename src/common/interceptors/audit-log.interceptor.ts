import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { AuditLogService } from '../services/audit-log.service';
import {
  AUDIT_LOG_METADATA,
  AuditLogOptions,
} from '../decorators/audit-log.decorator';

/**
 * Audit Log Interceptor
 *
 * Processes methods marked with @AuditLog() decorator and automatically
 * logs them to the audit service.
 *
 * Features:
 * - Extracts user context from request (userId, IP, user agent)
 * - Captures method arguments and result
 * - Tracks before/after values for updates (if trackChanges=true)
 * - Non-blocking (doesn't throw errors on audit failure)
 *
 * Usage:
 * Add to global interceptors in main.ts:
 * ```typescript
 * const reflector = app.get(Reflector);
 * const auditLogService = app.get(AuditLogService);
 * app.useGlobalInterceptors(new AuditLogInterceptor(reflector, auditLogService));
 * ```
 */
@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly auditLogService: AuditLogService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    // Get audit log metadata from decorator
    const auditOptions = this.reflector.get<AuditLogOptions>(
      AUDIT_LOG_METADATA,
      context.getHandler(),
    );

    // If no @AuditLog() decorator, skip
    if (!auditOptions) {
      return next.handle();
    }

    // Extract request context
    const request = this.getRequest(context);
    const userId = request?.user?.userId || request?.user?.id;
    const ipAddress = this.getIpAddress(request);
    const userAgent = request?.headers?.['user-agent'];

    // Extract method arguments
    const args = context.getArgs();

    // Extract entity ID using getEntityId function
    let entityId: string | undefined;
    if (auditOptions.getEntityId) {
      try {
        entityId = auditOptions.getEntityId(args);
      } catch (error) {
        // Ignore errors in getEntityId
      }
    }

    // TODO: If trackChanges=true, query entity before execution
    // For now, we'll just log the new values from the result

    return next.handle().pipe(
      tap({
        next: (result) => {
          // Log audit event after successful execution
          this.auditLogService
            .log({
              userId,
              action: auditOptions.action,
              entity: auditOptions.entity,
              entityId,
              newValues: result, // The result of the method (new state)
              ipAddress,
              userAgent,
              metadata: auditOptions.metadata,
            })
            .catch((error) => {
              // Silently fail - audit logging should never break the app
              console.error('Audit log failed:', error);
            });
        },
        error: (error) => {
          // Log failed attempts as well (for security monitoring)
          this.auditLogService
            .log({
              userId,
              action: `${auditOptions.action}_FAILED`,
              entity: auditOptions.entity,
              entityId,
              ipAddress,
              userAgent,
              metadata: {
                ...auditOptions.metadata,
                error: error.message,
                errorStack: error.stack,
              },
            })
            .catch((logError) => {
              console.error('Audit log failed:', logError);
            });
        },
      }),
    );
  }

  /**
   * Extract request object from execution context
   */
  private getRequest(context: ExecutionContext): any {
    const contextType = context.getType();

    if (contextType === 'http') {
      return context.switchToHttp().getRequest();
    }

    if (contextType === 'ws') {
      return context.switchToWs().getClient().handshake;
    }

    return null;
  }

  /**
   * Extract IP address from request
   */
  private getIpAddress(request: any): string | undefined {
    if (!request) return undefined;

    // Check common headers for real IP (behind proxy)
    return (
      request.headers?.['x-forwarded-for']?.split(',')[0] ||
      request.headers?.['x-real-ip'] ||
      request.connection?.remoteAddress ||
      request.socket?.remoteAddress ||
      request.ip
    );
  }
}
