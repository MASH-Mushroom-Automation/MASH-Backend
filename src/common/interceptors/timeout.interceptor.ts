import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  RequestTimeoutException,
} from '@nestjs/common';
import { Observable, throwError, TimeoutError } from 'rxjs';
import { catchError, timeout } from 'rxjs/operators';

/**
 * Timeout Interceptor
 *
 * Automatically throws a timeout exception if request takes too long
 *
 * Features:
 * - Configurable timeout duration (default: 30 seconds)
 * - Throws RequestTimeoutException (408)
 * - Prevents hanging requests
 */

@Injectable()
export class TimeoutInterceptor implements NestInterceptor {
  /**
   * Default timeout in milliseconds (30 seconds)
   */
  private readonly timeoutMs = 30000;

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const timeoutDuration = this.timeoutMs;

    return next.handle().pipe(
      timeout(timeoutDuration),
      catchError((err) => {
        if (err instanceof TimeoutError) {
          return throwError(
            () =>
              new RequestTimeoutException(
                `Request timeout after ${timeoutDuration}ms`,
              ),
          );
        }
        return throwError(() => err);
      }),
    );
  }
}
