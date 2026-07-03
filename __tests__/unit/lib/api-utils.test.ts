import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

import {
  createSuccessResponse,
  createErrorResponse,
  escapeRegex,
  handleApiError,
  validateRequiredFields,
  formatZodErrors,
  createRateLimitResponse,
  parsePagination,
  buildPaginationMeta,
  createPaginatedResponse,
  createValidationErrorResponse,
  requireApiAuth,
  HTTP_STATUS,
  API_CONFIG,
} from '@/lib/api-utils';

// Mock the logger to prevent console output
jest.mock('@/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

// Mock Clerk (imported by api-utils via auth-helpers)
jest.mock('@clerk/nextjs/server', () => ({
  auth: jest.fn(),
}));

describe('api-utils', () => {
  describe('HTTP_STATUS', () => {
    it('has correct status codes', () => {
      expect(HTTP_STATUS.OK).toBe(200);
      expect(HTTP_STATUS.CREATED).toBe(201);
      expect(HTTP_STATUS.BAD_REQUEST).toBe(400);
      expect(HTTP_STATUS.UNAUTHORIZED).toBe(401);
      expect(HTTP_STATUS.FORBIDDEN).toBe(403);
      expect(HTTP_STATUS.NOT_FOUND).toBe(404);
      expect(HTTP_STATUS.CONFLICT).toBe(409);
      expect(HTTP_STATUS.TOO_MANY_REQUESTS).toBe(429);
      expect(HTTP_STATUS.INTERNAL_SERVER_ERROR).toBe(500);
    });
  });

  describe('API_CONFIG', () => {
    it('has default page size', () => {
      expect(API_CONFIG.DEFAULT_PAGE_SIZE).toBe(10);
    });

    it('has max page size', () => {
      expect(API_CONFIG.MAX_PAGE_SIZE).toBe(100);
    });
  });

  describe('escapeRegex', () => {
    it('escapes special regex characters', () => {
      expect(escapeRegex('hello.world')).toBe('hello\\.world');
      expect(escapeRegex('test*')).toBe('test\\*');
      expect(escapeRegex('a+b')).toBe('a\\+b');
      expect(escapeRegex('(test)')).toBe('\\(test\\)');
      expect(escapeRegex('[abc]')).toBe('\\[abc\\]');
      expect(escapeRegex('a{3}')).toBe('a\\{3\\}');
      expect(escapeRegex('$100')).toBe('\\$100');
      expect(escapeRegex('^start')).toBe('\\^start');
      expect(escapeRegex('a|b')).toBe('a\\|b');
      expect(escapeRegex('path\\to')).toBe('path\\\\to');
      expect(escapeRegex('what?')).toBe('what\\?');
    });

    it('leaves safe strings unchanged', () => {
      expect(escapeRegex('hello')).toBe('hello');
      expect(escapeRegex('test 123')).toBe('test 123');
      expect(escapeRegex('')).toBe('');
    });
  });

  describe('createSuccessResponse', () => {
    it('returns success response with data', async () => {
      const data = { id: 1, name: 'Test' };
      const response = createSuccessResponse(data);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data).toEqual(data);
      expect(body.message).toBeUndefined();
    });

    it('includes message when provided', async () => {
      const response = createSuccessResponse({ id: 1 }, 'Created successfully');
      const body = await response.json();

      expect(body.message).toBe('Created successfully');
    });

    it('uses custom status code', async () => {
      const response = createSuccessResponse({ id: 1 }, 'Created', 201);
      expect(response.status).toBe(201);
    });
  });

  describe('createErrorResponse', () => {
    it('returns error response with string', async () => {
      const response = createErrorResponse('Something went wrong');
      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body.success).toBe(false);
      expect(body.error).toBe('Something went wrong');
    });

    it('extracts message from Error object', async () => {
      const response = createErrorResponse(new Error('Bad input'));
      const body = await response.json();

      expect(body.error).toBe('Bad input');
    });

    it('uses custom status code', async () => {
      const response = createErrorResponse('Not found', 404);
      expect(response.status).toBe(404);
    });

    it('includes details when provided', async () => {
      const details = { field: 'email', reason: 'invalid' };
      const response = createErrorResponse('Validation failed', 400, details);
      const body = await response.json();

      expect(body.details).toEqual(details);
    });

    it('omits details when not provided', async () => {
      const response = createErrorResponse('Error');
      const body = await response.json();

      expect(body.details).toBeUndefined();
    });
  });

  describe('handleApiError', () => {
    it('maps "not found" errors to 404', async () => {
      const response = handleApiError(new Error('Resource not found'));
      expect(response.status).toBe(404);
    });

    it('maps "unauthorized" errors to 401', async () => {
      const response = handleApiError(new Error('unauthorized access'));
      expect(response.status).toBe(401);
    });

    it('maps "authentication" errors to 401', async () => {
      const response = handleApiError(new Error('authentication failed'));
      expect(response.status).toBe(401);
    });

    it('maps "forbidden" errors to 403', async () => {
      const response = handleApiError(new Error('forbidden action'));
      expect(response.status).toBe(403);
    });

    it('maps "permission" errors to 403', async () => {
      const response = handleApiError(new Error('no permission'));
      expect(response.status).toBe(403);
    });

    it('maps "validation" errors to 400', async () => {
      const response = handleApiError(new Error('validation error'));
      expect(response.status).toBe(400);
    });

    it('maps "invalid" errors to 400', async () => {
      const response = handleApiError(new Error('invalid data'));
      expect(response.status).toBe(400);
    });

    it('defaults to 500 for unknown Error', async () => {
      const response = handleApiError(new Error('something broke'));
      expect(response.status).toBe(500);
    });

    it('handles non-Error types', async () => {
      const response = handleApiError('string error');
      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body.error).toBe('An unexpected error occurred');
    });

    it('handles null/undefined errors', async () => {
      const response = handleApiError(null);
      expect(response.status).toBe(500);
    });
  });

  describe('validateRequiredFields', () => {
    it('returns valid when all fields present', () => {
      const body = { name: 'Test', email: 'test@test.com' };
      const result = validateRequiredFields(body, ['name', 'email']);

      expect(result.isValid).toBe(true);
      expect(result.missingFields).toHaveLength(0);
    });

    it('detects undefined fields', () => {
      const body = { name: 'Test', email: undefined };
      const result = validateRequiredFields(body, ['name', 'email']);

      expect(result.isValid).toBe(false);
      expect(result.missingFields).toContain('email');
    });

    it('detects null fields', () => {
      const body = { name: null, email: 'test@test.com' };
      const result = validateRequiredFields(body, ['name', 'email']);

      expect(result.isValid).toBe(false);
      expect(result.missingFields).toContain('name');
    });

    it('detects empty string fields', () => {
      const body = { name: '', email: 'test@test.com' };
      const result = validateRequiredFields(body, ['name', 'email']);

      expect(result.isValid).toBe(false);
      expect(result.missingFields).toContain('name');
    });

    it('returns all missing fields', () => {
      const body = { name: undefined, email: null, phone: '' };
      const result = validateRequiredFields(body, ['name', 'email', 'phone']);

      expect(result.missingFields).toHaveLength(3);
    });
  });

  describe('formatZodErrors', () => {
    it('formats errors by path', () => {
      const mockZodError = {
        issues: [
          { path: ['name'], message: 'Name is required' },
          { path: ['email'], message: 'Invalid email' },
        ],
      };

      const result = formatZodErrors(mockZodError as any);

      expect(result.name).toEqual(['Name is required']);
      expect(result.email).toEqual(['Invalid email']);
    });

    it('groups multiple errors for same path', () => {
      const mockZodError = {
        issues: [
          { path: ['name'], message: 'Too short' },
          { path: ['name'], message: 'Invalid characters' },
        ],
      };

      const result = formatZodErrors(mockZodError as any);

      expect(result.name).toEqual(['Too short', 'Invalid characters']);
    });

    it('handles nested paths', () => {
      const mockZodError = {
        issues: [{ path: ['address', 'city'], message: 'City required' }],
      };

      const result = formatZodErrors(mockZodError as any);

      expect(result['address.city']).toEqual(['City required']);
    });

    it('uses _root for root-level errors', () => {
      const mockZodError = {
        issues: [{ path: [], message: 'Invalid object' }],
      };

      const result = formatZodErrors(mockZodError as any);

      expect(result._root).toEqual(['Invalid object']);
    });
  });

  describe('createValidationErrorResponse', () => {
    it('returns 400 with formatted errors', async () => {
      const mockZodError = {
        issues: [{ path: ['name'], message: 'Required' }],
      };

      const response = createValidationErrorResponse(mockZodError as any);
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.error).toBe('Validation failed');
      expect(body.details).toEqual({ name: ['Required'] });
    });
  });

  describe('createRateLimitResponse', () => {
    it('returns 429 with retry headers', async () => {
      const resetTime = Date.now() + 60000; // 60 seconds from now
      const response = createRateLimitResponse(resetTime);
      const body = await response.json();

      expect(response.status).toBe(429);
      expect(body.success).toBe(false);
      expect(body.error).toContain('Too many requests');
      expect(body.retryAfter).toBeGreaterThan(0);
      expect(response.headers.get('Retry-After')).toBeDefined();
      expect(response.headers.get('X-RateLimit-Reset')).toBe(String(resetTime));
    });
  });

  describe('parsePagination', () => {
    it('returns defaults when no params', () => {
      const params = new URLSearchParams();
      const result = parsePagination(params);

      expect(result.page).toBe(1);
      expect(result.limit).toBe(API_CONFIG.DEFAULT_PAGE_SIZE);
      expect(result.skip).toBe(0);
    });

    it('parses page and limit', () => {
      const params = new URLSearchParams({ page: '3', limit: '20' });
      const result = parsePagination(params);

      expect(result.page).toBe(3);
      expect(result.limit).toBe(20);
      expect(result.skip).toBe(40);
    });

    it('clamps page to minimum 1', () => {
      const params = new URLSearchParams({ page: '-5' });
      const result = parsePagination(params);

      expect(result.page).toBe(1);
    });

    it('clamps limit to minimum 1', () => {
      const params = new URLSearchParams({ limit: '0' });
      const result = parsePagination(params);

      expect(result.limit).toBe(1);
    });

    it('clamps limit to MAX_PAGE_SIZE', () => {
      const params = new URLSearchParams({ limit: '999' });
      const result = parsePagination(params);

      expect(result.limit).toBe(API_CONFIG.MAX_PAGE_SIZE);
    });

    it('returns NaN-derived values for non-numeric inputs', () => {
      // Note: parseInt('abc') returns NaN, and Math.max(1, NaN) returns NaN
      // This is a known edge case — callers should sanitize inputs
      const params = new URLSearchParams({ page: 'abc', limit: 'xyz' });
      const result = parsePagination(params);

      expect(result.page).toBeNaN();
      expect(result.limit).toBeNaN();
    });
  });

  describe('buildPaginationMeta', () => {
    it('calculates pagination metadata', () => {
      const meta = buildPaginationMeta(50, 2, 10);

      expect(meta.currentPage).toBe(2);
      expect(meta.totalPages).toBe(5);
      expect(meta.totalItems).toBe(50);
      expect(meta.limit).toBe(10);
      expect(meta.hasNextPage).toBe(true);
      expect(meta.hasPrevPage).toBe(true);
    });

    it('first page has no prev', () => {
      const meta = buildPaginationMeta(50, 1, 10);

      expect(meta.hasPrevPage).toBe(false);
      expect(meta.hasNextPage).toBe(true);
    });

    it('last page has no next', () => {
      const meta = buildPaginationMeta(50, 5, 10);

      expect(meta.hasNextPage).toBe(false);
      expect(meta.hasPrevPage).toBe(true);
    });

    it('single page has neither prev nor next', () => {
      const meta = buildPaginationMeta(5, 1, 10);

      expect(meta.totalPages).toBe(1);
      expect(meta.hasNextPage).toBe(false);
      expect(meta.hasPrevPage).toBe(false);
    });

    it('handles zero items', () => {
      const meta = buildPaginationMeta(0, 1, 10);

      expect(meta.totalPages).toBe(0);
      expect(meta.hasNextPage).toBe(false);
      expect(meta.hasPrevPage).toBe(false);
    });
  });

  describe('createPaginatedResponse', () => {
    it('combines data with pagination metadata', async () => {
      const data = [{ id: 1 }, { id: 2 }];
      const response = createPaginatedResponse(data, 50, 1, 10);
      const body = await response.json();

      expect(body.success).toBe(true);
      expect(body.data).toEqual(data);
      expect(body.pagination.totalItems).toBe(50);
      expect(body.pagination.currentPage).toBe(1);
      expect(body.pagination.limit).toBe(10);
    });
  });

  describe('requireApiAuth', () => {
    const mockAuth = auth as unknown as jest.Mock;
    const originalTesting = process.env.NEXT_PUBLIC_TESTING;

    afterEach(() => {
      process.env.NEXT_PUBLIC_TESTING = originalTesting;
      mockAuth.mockReset();
    });

    it('bypasses auth when NEXT_PUBLIC_TESTING=true outside production', async () => {
      process.env.NEXT_PUBLIC_TESTING = 'true';

      const result = await requireApiAuth();

      expect(result).toEqual({ authenticated: true, userId: 'test-user' });
      expect(mockAuth).not.toHaveBeenCalled();
    });

    it('returns 401 when there is no user', async () => {
      process.env.NEXT_PUBLIC_TESTING = 'false';
      mockAuth.mockResolvedValue({ userId: null, has: undefined });

      const result = await requireApiAuth();

      expect(result.authenticated).toBe(false);
      expect(result.error?.status).toBe(HTTP_STATUS.UNAUTHORIZED);
    });

    it('returns 403 when the user lacks an authorized role', async () => {
      process.env.NEXT_PUBLIC_TESTING = 'false';
      mockAuth.mockResolvedValue({
        userId: 'user_123',
        has: ({ role }: { role: string }) => role === 'org:customer',
      });

      const result = await requireApiAuth();

      expect(result.authenticated).toBe(false);
      expect(result.error?.status).toBe(HTTP_STATUS.FORBIDDEN);
    });

    it('returns the userId for authorized admins', async () => {
      process.env.NEXT_PUBLIC_TESTING = 'false';
      mockAuth.mockResolvedValue({
        userId: 'user_admin',
        has: ({ role }: { role: string }) => role === 'org:admin',
      });

      const result = await requireApiAuth();

      expect(result).toEqual({ authenticated: true, userId: 'user_admin' });
    });

    it('returns 401 when the auth check throws', async () => {
      process.env.NEXT_PUBLIC_TESTING = 'false';
      mockAuth.mockRejectedValue(new Error('clerk unavailable'));

      const result = await requireApiAuth();

      expect(result.authenticated).toBe(false);
      expect(result.error?.status).toBe(HTTP_STATUS.UNAUTHORIZED);
    });
  });
});
