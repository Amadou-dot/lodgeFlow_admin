/**
 * Dual-mode rate limiter.
 *
 * - **Distributed (production):** when `UPSTASH_REDIS_REST_URL` and
 *   `UPSTASH_REDIS_REST_TOKEN` are set, limits are enforced globally via
 *   `@upstash/ratelimit` so they hold across serverless instances.
 * - **In-memory (local development, tests):** without those variables, limits
 *   fall back to a module-level `Map`. That store is per-instance, so it is
 *   only meaningful for single-instance deployments.
 *
 * Both modes use a fixed window, so their semantics match.
 */

import { Ratelimit } from '@upstash/ratelimit';

import { logger } from '@/lib/logger';
import { getRedisClient, REDIS_KEY_PREFIX } from '@/lib/redis';

interface RateLimitRecord {
  count: number;
  resetTime: number;
}

// In-memory storage for rate limit records
const rateLimitStore = new Map<string, RateLimitRecord>();

// Clean up expired records periodically (every 5 minutes)
const CLEANUP_INTERVAL = 5 * 60 * 1000;
let lastCleanup = Date.now();

function cleanupExpiredRecords() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;

  lastCleanup = now;
  const keysToDelete: string[] = [];

  rateLimitStore.forEach((record, key) => {
    if (now > record.resetTime) {
      keysToDelete.push(key);
    }
  });

  keysToDelete.forEach(key => rateLimitStore.delete(key));
}

export interface RateLimitConfig {
  /** Maximum number of requests allowed in the window */
  limit: number;
  /** Time window in milliseconds */
  windowMs: number;
}

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  resetTime: number;
}

/**
 * Default rate limit configurations for different endpoint types
 */
export const RATE_LIMIT_CONFIGS = {
  /** Standard mutation endpoints (create, update, delete) */
  MUTATION: { limit: 30, windowMs: 60 * 1000 }, // 30 requests per minute

  /** Email sending endpoints (stricter to prevent spam) */
  EMAIL: { limit: 5, windowMs: 60 * 1000 }, // 5 emails per minute

  /** Customer creation (prevent mass account creation) */
  CUSTOMER_CREATE: { limit: 10, windowMs: 60 * 1000 }, // 10 per minute

  /** Booking creation */
  BOOKING_CREATE: { limit: 20, windowMs: 60 * 1000 }, // 20 per minute

  /** Authentication-related endpoints */
  AUTH: { limit: 10, windowMs: 60 * 1000 }, // 10 attempts per minute
} as const;

/**
 * Cached `Ratelimit` instances keyed by `limit:windowMs`. Constructing one per
 * request would rebuild the underlying scripts on every call.
 */
const limiterCache = new Map<string, Ratelimit>();

function getDistributedLimiter(
  redis: NonNullable<ReturnType<typeof getRedisClient>>,
  config: RateLimitConfig
): Ratelimit {
  const cacheKey = `${config.limit}:${config.windowMs}`;
  const cached = limiterCache.get(cacheKey);
  if (cached) return cached;

  const limiter = new Ratelimit({
    redis,
    // Fixed window matches the in-memory fallback's semantics.
    limiter: Ratelimit.fixedWindow(config.limit, `${config.windowMs} ms`),
    prefix: `${REDIS_KEY_PREFIX}:ratelimit`,
  });

  limiterCache.set(cacheKey, limiter);
  return limiter;
}

/**
 * Check if a request should be rate limited.
 *
 * Uses Redis when Upstash is configured, otherwise the in-memory store. If a
 * configured Redis is unreachable the check **fails open** — the request is
 * allowed and the error is logged, so an Upstash outage degrades to "no rate
 * limiting" rather than taking the endpoint down.
 *
 * @param identifier - Unique identifier for the rate limit (e.g., userId, IP address)
 * @param config - Rate limit configuration
 * @returns Rate limit result with success status and metadata
 */
export async function checkRateLimit(
  identifier: string,
  config: RateLimitConfig = RATE_LIMIT_CONFIGS.MUTATION
): Promise<RateLimitResult> {
  const redis = getRedisClient();

  if (redis) {
    try {
      const { success, remaining, reset } = await getDistributedLimiter(
        redis,
        config
      ).limit(identifier);

      return { success, limit: config.limit, remaining, resetTime: reset };
    } catch (error) {
      logger.error(
        'Distributed rate limit check failed, allowing request',
        error,
        { identifier }
      );

      // Fail open. No counter was incremented, so report the full budget.
      return {
        success: true,
        limit: config.limit,
        remaining: config.limit,
        resetTime: Date.now() + config.windowMs,
      };
    }
  }

  return checkRateLimitInMemory(identifier, config);
}

/**
 * In-memory fallback used when Upstash is not configured.
 *
 * Exported for tests; production code should call `checkRateLimit()`.
 */
export function checkRateLimitInMemory(
  identifier: string,
  config: RateLimitConfig = RATE_LIMIT_CONFIGS.MUTATION
): RateLimitResult {
  cleanupExpiredRecords();

  const now = Date.now();
  const record = rateLimitStore.get(identifier);

  // If no record exists or window has expired, create new record
  if (!record || now > record.resetTime) {
    const newRecord: RateLimitRecord = {
      count: 1,
      resetTime: now + config.windowMs,
    };
    rateLimitStore.set(identifier, newRecord);

    return {
      success: true,
      limit: config.limit,
      remaining: config.limit - 1,
      resetTime: newRecord.resetTime,
    };
  }

  // Check if limit exceeded
  if (record.count >= config.limit) {
    return {
      success: false,
      limit: config.limit,
      remaining: 0,
      resetTime: record.resetTime,
    };
  }

  // Increment counter
  record.count++;

  return {
    success: true,
    limit: config.limit,
    remaining: config.limit - record.count,
    resetTime: record.resetTime,
  };
}

/**
 * Create a rate limit key from user ID and endpoint
 */
export function createRateLimitKey(
  userId: string | undefined,
  endpoint: string
): string {
  return `${userId || 'anonymous'}:${endpoint}`;
}

/**
 * Clear both the in-memory records and the cached `Ratelimit` instances.
 * Test-only — lets a suite switch between the distributed and in-memory paths.
 */
export function resetRateLimitState(): void {
  rateLimitStore.clear();
  limiterCache.clear();
  lastCleanup = Date.now();
}
