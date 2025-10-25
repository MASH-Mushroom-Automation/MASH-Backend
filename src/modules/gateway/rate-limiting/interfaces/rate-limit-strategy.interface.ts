/**
 * RateLimitStrategy Interface
 *
 * Base interface for all rate limiting strategies.
 * Each strategy implements a different algorithm for controlling request rates.
 *
 * Supported Strategies:
 * - TOKEN_BUCKET: Allows bursts, tokens refill at fixed rate
 * - LEAKY_BUCKET: Smooths traffic, processes at fixed rate
 * - FIXED_WINDOW: Resets counter at fixed intervals
 * - SLIDING_WINDOW: More accurate than fixed window, no reset spikes
 * - ADAPTIVE: Adjusts limits based on system load
 */

export interface IRateLimitConfig {
  /** Maximum number of requests allowed */
  limit: number;

  /** Time window in milliseconds */
  windowMs: number;

  /** Strategy-specific configuration */
  options?: {
    /** Token bucket: tokens added per interval */
    refillRate?: number;

    /** Token bucket: maximum burst size */
    burstSize?: number;

    /** Leaky bucket: processing rate (requests/sec) */
    leakRate?: number;

    /** Adaptive: target system utilization (0-1) */
    targetUtilization?: number;

    /** Adaptive: adjustment factor (0-1) */
    adjustmentFactor?: number;

    /** Adaptive: minimum allowed limit (safety floor) */
    minLimit?: number;

    /** Adaptive: maximum allowed limit (safety ceiling) */
    maxLimit?: number;
  };
}

export interface IRateLimitResult {
  /** Whether the request is allowed */
  allowed: boolean;

  /** Current token/request count */
  current: number;

  /** Maximum allowed */
  limit: number;

  /** Remaining tokens/requests */
  remaining: number;

  /** Time until reset/refill (milliseconds) */
  resetMs: number;

  /** Time to wait before retry (milliseconds) */
  retryAfterMs?: number;

  /** Additional metadata */
  metadata?: {
    /** Strategy name */
    strategy?: string;

    /** Current bucket level (for token/leaky bucket) */
    bucketLevel?: number;

    /** Last refill/leak time */
    lastUpdateMs?: number;

    /** Requests in current window (for sliding window) */
    windowRequests?: number[];

    /** Current adaptive limit (for adaptive) */
    adaptiveLimit?: number;

    /** Base limit before adjustments (for adaptive) */
    baseLimit?: number;

    /** System load factor (for adaptive) */
    systemLoad?: number;

    /** User behavior score (for adaptive) */
    userScore?: number;

    /** Window start timestamp (for fixed window) */
    windowStart?: number;

    /** General message */
    message?: string;
  };
}

export interface IRateLimitStrategy {
  /**
   * Check if a request should be allowed
   *
   * @param key - Unique identifier (e.g., userId:endpoint)
   * @param config - Rate limit configuration
   * @returns Rate limit result with allow/deny and metadata
   */
  checkLimit(key: string, config: IRateLimitConfig): Promise<IRateLimitResult>;

  /**
   * Reset rate limit for a specific key
   *
   * @param key - Unique identifier to reset
   */
  reset(key: string): Promise<void>;

  /**
   * Get current state for a key (for monitoring)
   *
   * @param key - Unique identifier
   * @returns Current rate limit state
   */
  getState(key: string): Promise<IRateLimitResult | null>;

  /**
   * Get strategy name
   */
  getName(): string;
}

/**
 * Rate limit store interface (Redis implementation)
 */
export interface IRateLimitStore {
  /**
   * Get value from store
   */
  get(key: string): Promise<string | null>;

  /**
   * Set value with TTL
   */
  set(key: string, value: string, ttlMs: number): Promise<boolean>;

  /**
   * Increment counter atomically
   */
  increment(key: string, ttlMs: number): Promise<number>;

  /**
   * Delete key
   */
  delete(key: string): Promise<boolean>;

  /**
   * Get TTL for key
   */
  getTTL(key: string): Promise<number>;
}
