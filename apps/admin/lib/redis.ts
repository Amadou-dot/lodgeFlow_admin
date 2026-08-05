/**
 * Shared Upstash Redis client for cross-instance state.
 *
 * Vercel runs each request on a potentially different serverless instance, so
 * module-level `Map`s are per-instance and cannot back a global rate limit or a
 * shared cache. When `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`
 * are both set, callers get a Redis client and use the distributed path; when
 * either is missing (local development, tests) `getRedisClient()` returns
 * `null` and callers fall back to their in-memory implementation.
 */

import { Redis } from '@upstash/redis';

/** Key namespace so LodgeFlow keys never collide with other apps on the DB. */
export const REDIS_KEY_PREFIX = 'lodgeflow';

// `undefined` means "not resolved yet", `null` means "resolved: not configured".
let cachedClient: Redis | null | undefined;

/**
 * Get the shared Redis client, or `null` when Upstash is not configured.
 *
 * The result is memoized, so changing the environment variables at runtime has
 * no effect until the process restarts (or `resetRedisClient()` is called).
 */
export function getRedisClient(): Redis | null {
  if (cachedClient !== undefined) return cachedClient;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  cachedClient = url && token ? new Redis({ url, token }) : null;

  return cachedClient;
}

/**
 * Whether distributed state is available in this environment.
 */
export function isRedisConfigured(): boolean {
  return getRedisClient() !== null;
}

/**
 * Clear the memoized client. Test-only — lets a suite toggle the environment
 * variables between the distributed and in-memory code paths.
 */
export function resetRedisClient(): void {
  cachedClient = undefined;
}
