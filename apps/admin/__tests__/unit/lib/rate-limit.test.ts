/* eslint-disable @typescript-eslint/no-explicit-any */

// Mocks are hoisted above the imports, so the factories below reference the
// `mock*` bindings lazily (inside arrow functions) to avoid a TDZ error.
const mockRatelimitLimit = jest.fn();
const mockFixedWindow = jest.fn((limit: number, window: string) => ({
  limit,
  window,
}));
const mockRatelimitConstructor = jest.fn();

jest.mock('@upstash/ratelimit', () => ({
  Ratelimit: Object.assign(
    function Ratelimit(this: any, config: any) {
      mockRatelimitConstructor(config);
      this.limit = (...args: any[]) => mockRatelimitLimit(...args);
    },
    { fixedWindow: (...args: any[]) => (mockFixedWindow as any)(...args) }
  ),
}));

jest.mock('@upstash/redis', () => ({
  Redis: jest.fn().mockImplementation(() => ({ __upstash: true })),
}));

import {
  checkRateLimit,
  checkRateLimitInMemory,
  createRateLimitKey,
  RATE_LIMIT_CONFIGS,
  resetRateLimitState,
} from '@/lib/rate-limit';
import { resetRedisClient } from '@/lib/redis';

const REDIS_ENV = {
  UPSTASH_REDIS_REST_URL: 'https://example.upstash.io',
  UPSTASH_REDIS_REST_TOKEN: 'test-token',
};

function enableRedis(): void {
  Object.assign(process.env, REDIS_ENV);
  resetRedisClient();
}

function disableRedis(): void {
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
  resetRedisClient();
}

// Each test uses a fresh identifier so it is isolated from earlier records.
let uniqueCounter = 0;
function key(prefix = 'rl'): string {
  uniqueCounter++;
  return `${prefix}_${Date.now()}_${uniqueCounter}`;
}

beforeEach(() => {
  jest.clearAllMocks();
  resetRateLimitState();
  disableRedis();
});

afterEach(() => {
  disableRedis();
  jest.useRealTimers();
});

describe('createRateLimitKey', () => {
  it('namespaces the key by user and endpoint', () => {
    expect(createRateLimitKey('user_123', 'send-confirm')).toBe(
      'user_123:send-confirm'
    );
  });

  it('falls back to "anonymous" when there is no user id', () => {
    expect(createRateLimitKey(undefined, 'send-confirm')).toBe(
      'anonymous:send-confirm'
    );
  });
});

describe('checkRateLimit — in-memory fallback (Upstash env vars unset)', () => {
  const config = { limit: 3, windowMs: 60 * 1000 };

  it('allows requests up to the limit and decrements remaining', async () => {
    const identifier = key();

    const first = await checkRateLimit(identifier, config);
    expect(first).toMatchObject({ success: true, limit: 3, remaining: 2 });

    const second = await checkRateLimit(identifier, config);
    expect(second).toMatchObject({ success: true, remaining: 1 });

    const third = await checkRateLimit(identifier, config);
    expect(third).toMatchObject({ success: true, remaining: 0 });
  });

  it('blocks the request that exceeds the limit', async () => {
    const identifier = key();
    for (let i = 0; i < config.limit; i++) {
      await checkRateLimit(identifier, config);
    }

    const blocked = await checkRateLimit(identifier, config);
    expect(blocked.success).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.resetTime).toBeGreaterThan(Date.now());
  });

  it('tracks identifiers independently', async () => {
    const a = key('a');
    const b = key('b');

    for (let i = 0; i < config.limit; i++) {
      await checkRateLimit(a, config);
    }

    expect((await checkRateLimit(a, config)).success).toBe(false);
    expect((await checkRateLimit(b, config)).success).toBe(true);
  });

  it('starts a new window once the previous one expires', async () => {
    const identifier = key();
    const nowSpy = jest.spyOn(Date, 'now');
    const start = 1_000_000;

    nowSpy.mockReturnValue(start);
    for (let i = 0; i < config.limit; i++) {
      await checkRateLimit(identifier, config);
    }
    expect((await checkRateLimit(identifier, config)).success).toBe(false);

    // Advance past the window boundary.
    nowSpy.mockReturnValue(start + config.windowMs + 1);
    const afterReset = await checkRateLimit(identifier, config);
    expect(afterReset).toMatchObject({ success: true, remaining: 2 });

    nowSpy.mockRestore();
  });

  it('defaults to the MUTATION config', async () => {
    const result = await checkRateLimit(key());
    expect(result.limit).toBe(RATE_LIMIT_CONFIGS.MUTATION.limit);
  });

  it('does not construct an Upstash limiter', async () => {
    await checkRateLimit(key(), config);
    expect(mockRatelimitConstructor).not.toHaveBeenCalled();
    expect(mockRatelimitLimit).not.toHaveBeenCalled();
  });
});

describe('checkRateLimitInMemory', () => {
  it('is unaffected by Upstash being configured', () => {
    enableRedis();
    const identifier = key();

    const result = checkRateLimitInMemory(identifier, {
      limit: 1,
      windowMs: 60_000,
    });

    expect(result).toMatchObject({ success: true, remaining: 0 });
    expect(mockRatelimitLimit).not.toHaveBeenCalled();
  });
});

describe('checkRateLimit — distributed store selection (Upstash env vars set)', () => {
  const config = { limit: 5, windowMs: 60 * 1000 };

  beforeEach(() => {
    enableRedis();
  });

  it('routes the check through @upstash/ratelimit instead of the local Map', async () => {
    const reset = Date.now() + 60_000;
    mockRatelimitLimit.mockResolvedValue({
      success: true,
      limit: 5,
      remaining: 4,
      reset,
    });

    const identifier = key();
    const result = await checkRateLimit(identifier, config);

    expect(mockRatelimitLimit).toHaveBeenCalledWith(identifier);
    expect(result).toEqual({
      success: true,
      limit: 5,
      remaining: 4,
      resetTime: reset,
    });
  });

  it('builds a fixed window matching the config and namespaces the keys', async () => {
    mockRatelimitLimit.mockResolvedValue({
      success: true,
      limit: 5,
      remaining: 4,
      reset: Date.now(),
    });

    await checkRateLimit(key(), config);

    expect(mockFixedWindow).toHaveBeenCalledWith(5, '60000 ms');
    expect(mockRatelimitConstructor).toHaveBeenCalledWith(
      expect.objectContaining({ prefix: 'lodgeflow:ratelimit' })
    );
  });

  it('reuses one limiter per config instead of rebuilding it each call', async () => {
    mockRatelimitLimit.mockResolvedValue({
      success: true,
      limit: 5,
      remaining: 4,
      reset: Date.now(),
    });

    await checkRateLimit(key(), config);
    await checkRateLimit(key(), config);
    await checkRateLimit(key(), config);

    expect(mockRatelimitConstructor).toHaveBeenCalledTimes(1);
    expect(mockRatelimitLimit).toHaveBeenCalledTimes(3);
  });

  it('builds a separate limiter for a different config', async () => {
    mockRatelimitLimit.mockResolvedValue({
      success: true,
      limit: 5,
      remaining: 4,
      reset: Date.now(),
    });

    await checkRateLimit(key(), RATE_LIMIT_CONFIGS.EMAIL);
    await checkRateLimit(key(), RATE_LIMIT_CONFIGS.CUSTOMER_CREATE);

    expect(mockRatelimitConstructor).toHaveBeenCalledTimes(2);
  });

  it('propagates a denial from the distributed store', async () => {
    const reset = Date.now() + 30_000;
    mockRatelimitLimit.mockResolvedValue({
      success: false,
      limit: 5,
      remaining: 0,
      reset,
    });

    const result = await checkRateLimit(key(), config);

    expect(result).toEqual({
      success: false,
      limit: 5,
      remaining: 0,
      resetTime: reset,
    });
  });

  it('fails open when Redis is unreachable', async () => {
    mockRatelimitLimit.mockRejectedValue(new Error('ECONNREFUSED'));

    const result = await checkRateLimit(key(), config);

    expect(result.success).toBe(true);
    expect(result.limit).toBe(config.limit);
    // No counter was incremented, so the full budget is reported.
    expect(result.remaining).toBe(config.limit);
    expect(result.resetTime).toBeGreaterThan(Date.now());
  });

  it('keeps failing open on repeated Redis errors rather than blocking traffic', async () => {
    mockRatelimitLimit.mockRejectedValue(new Error('ECONNREFUSED'));
    const identifier = key();

    for (let i = 0; i < 10; i++) {
      expect((await checkRateLimit(identifier, config)).success).toBe(true);
    }
  });
});
