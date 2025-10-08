/**
 * Request Context Interface
 *
 * Contains metadata about the current HTTP request
 * Used for logging, tracking, and context propagation
 */
export interface RequestContext {
  /**
   * Unique correlation ID for the request
   */
  correlationId: string;

  /**
   * User ID (if authenticated)
   */
  userId?: string;

  /**
   * User email (if authenticated)
   */
  userEmail?: string;

  /**
   * Request timestamp
   */
  timestamp: Date;

  /**
   * HTTP method (GET, POST, etc.)
   */
  method: string;

  /**
   * Request URL/path
   */
  url: string;

  /**
   * Client IP address
   */
  ip: string;

  /**
   * User agent string
   */
  userAgent: string;

  /**
   * Request headers
   */
  headers?: Record<string, string>;

  /**
   * Query parameters
   */
  query?: Record<string, any>;

  /**
   * Route parameters
   */
  params?: Record<string, string>;

  /**
   * Request body (sanitized)
   */
  body?: any;

  /**
   * Start time for duration calculation
   */
  startTime: number;

  /**
   * Request duration in milliseconds
   */
  duration?: number;
}

/**
 * Helper function to create request context from Express request
 */
export function createRequestContext(req: any): RequestContext {
  return {
    correlationId:
      req.correlationId || req.headers['x-correlation-id'] || 'unknown',
    userId: req.user?.id,
    userEmail: req.user?.email,
    timestamp: new Date(),
    method: req.method,
    url: req.originalUrl || req.url,
    ip: req.ip || req.connection.remoteAddress,
    userAgent: req.get('user-agent') || 'Unknown',
    headers: req.headers,
    query: req.query,
    params: req.params,
    body: req.body,
    startTime: req.startTime || Date.now(),
  };
}
