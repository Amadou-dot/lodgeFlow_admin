import { logger } from '@/lib/logger';
jest.mock('@/lib/staff-access', () => ({
  resolveStaffRole: jest.fn().mockResolvedValue(null),
}));

import {
  createSuccessResponse,
  createErrorResponse,
  escapeRegex,
  formatZodErrors,
  createRateLimitResponse,
  parsePagination,
  parseIntParam,
  createValidationErrorResponse,
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
    it.each([400, 401, 403, 404, 409, 429])(
      'does not log expected %i responses as server errors',
      status => {
        jest.mocked(logger.error).mockClear();
        jest.mocked(logger.info).mockClear();
        expect(createErrorResponse('Request rejected', status).status).toBe(
          status
        );
        expect(logger.error).not.toHaveBeenCalled();
        expect(logger.info).toHaveBeenCalledWith(
          'API request rejected',
          expect.objectContaining({ status })
        );
      }
    );

    it('still logs server failures as errors', () => {
      jest.mocked(logger.error).mockClear();
      createErrorResponse('Service unavailable', 503);
      expect(logger.error).toHaveBeenCalledWith(
        'API Error',
        undefined,
        expect.objectContaining({ status: 503 })
      );
    });

    it('returns error response with string', async () => {
      const response = createErrorResponse('Something went wrong');
      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body.success).toBe(false);
      expect(body.error).toBe('Something went wrong');
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

    it('falls back to defaults for non-numeric inputs', () => {
      const params = new URLSearchParams({ page: 'abc', limit: 'xyz' });
      const result = parsePagination(params);

      expect(result.page).toBe(1);
      expect(result.limit).toBe(API_CONFIG.DEFAULT_PAGE_SIZE);
      expect(result.skip).toBe(0);
    });
  });

  describe('parseIntParam', () => {
    it('parses valid integers', () => {
      expect(parseIntParam('42', 1)).toBe(42);
    });

    it('falls back for null', () => {
      expect(parseIntParam(null, 7)).toBe(7);
    });

    it('falls back for non-numeric strings', () => {
      expect(parseIntParam('abc', 7)).toBe(7);
    });
  });
});
