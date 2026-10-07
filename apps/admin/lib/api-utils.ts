import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

import { isAuthBypassEnabled } from './auth-helpers';
import { resolveStaffRole } from './staff-access';
import { hasPermission, type Permission, type StaffRole } from './permissions';
import { logger } from './logger';

/**
 * Standard API response interfaces
 */
export interface ApiSuccessResponse<T = unknown> {
  success: true;
  data: T;
  message?: string;
}

export interface ApiErrorResponse {
  success: false;
  error: string;
  details?: unknown;
}

export type ApiResponse<T = unknown> = ApiSuccessResponse<T> | ApiErrorResponse;

/**
 * Common error status codes
 */
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
} as const;

/**
 * API configuration constants
 */
export const API_CONFIG = {
  DEFAULT_PAGE_SIZE: 10,
  MAX_PAGE_SIZE: 100,
} as const;

/**
 * Create a standardized success response
 */
export function createSuccessResponse<T>(
  data: T,
  message?: string,
  status: number = 200
): NextResponse<ApiSuccessResponse<T>> {
  const response: ApiSuccessResponse<T> = {
    success: true,
    data,
  };

  if (message) {
    response.message = message;
  }

  return NextResponse.json(response, { status });
}

/**
 * Create a standardized error response
 */
export function createErrorResponse(
  errorMessage: string,
  status: number = 500,
  details?: unknown
): NextResponse<ApiErrorResponse> {
  const context = { status, message: errorMessage, details };
  if (status >= 500) {
    logger.error('API Error', undefined, context);
  } else {
    // Expected denials and invalid requests are not server failures. In a
    // server layout, console.error also triggers Next's development overlay.
    logger.info('API request rejected', context);
  }

  const response: ApiErrorResponse = {
    success: false,
    error: errorMessage,
  };

  if (details !== undefined) {
    response.details = details;
  }

  return NextResponse.json(response, { status });
}

/**
 * API Authentication result
 */
export type ApiAuthResult =
  | { authenticated: true; userId: string; role: StaffRole }
  | { authenticated: false; error: NextResponse<ApiErrorResponse> };

/**
 * Require authentication for API routes
 * Returns userId if authenticated, or an error response if not
 *
 * Usage:
 * ```typescript
 * export async function GET(request: NextRequest) {
 *   const authResult = await requireApiAuth();
 *   if (!authResult.authenticated) return authResult.error;
 *   // ... rest of handler
 * }
 * ```
 */
export async function requireApiAuth(
  options: { permission?: Permission } = {}
): Promise<ApiAuthResult> {
  // Bypass auth for local development/testing only (fails closed in prod).
  if (isAuthBypassEnabled()) {
    return {
      authenticated: true,
      userId: 'test-user',
      role: 'admin',
    };
  }

  try {
    const { userId, orgId } = await auth();

    if (!userId) {
      return {
        authenticated: false,
        error: createErrorResponse('Unauthorized', HTTP_STATUS.UNAUTHORIZED),
      };
    }

    const role = await resolveStaffRole({
      userId: userId,
      activeOrganizationId: orgId ?? null,
    });
    if (!role || !hasPermission(role, options.permission)) {
      return {
        authenticated: false,
        error: createErrorResponse(
          'Forbidden: Insufficient permissions',
          HTTP_STATUS.FORBIDDEN
        ),
      };
    }

    return {
      authenticated: true,
      userId,
      role,
    };
  } catch (error) {
    logger.error(
      'Auth check failed',
      error instanceof Error ? error : undefined
    );
    return {
      authenticated: false,
      error: createErrorResponse(
        'Authentication failed',
        HTTP_STATUS.UNAUTHORIZED
      ),
    };
  }
}

/**
 * Escape special regex characters in a string
 * Prevents regex injection attacks in MongoDB queries
 */
export function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Parse an integer query param, falling back when missing or malformed
 */
export function parseIntParam(value: string | null, fallback: number): number {
  const parsed = parseInt(value ?? '', 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

/**
 * Create a rate limit exceeded response with appropriate headers
 */
export function createRateLimitResponse(resetTime: number) {
  const retryAfter = Math.ceil((resetTime - Date.now()) / 1000);

  return NextResponse.json(
    {
      success: false,
      error: 'Too many requests. Please try again later.',
      retryAfter,
    },
    {
      status: HTTP_STATUS.TOO_MANY_REQUESTS,
      headers: {
        'Retry-After': String(retryAfter),
        'X-RateLimit-Reset': String(resetTime),
      },
    }
  );
}

/**
 * Format Zod validation errors into a user-friendly format
 */
export function formatZodErrors(
  error: import('zod').ZodError
): Record<string, string[]> {
  const formatted = new Map<string, string[]>();

  for (const issue of error.issues) {
    const path = issue.path.join('.') || '_root';
    const messages = formatted.get(path) ?? [];
    messages.push(issue.message);
    formatted.set(path, messages);
  }

  return Object.fromEntries(formatted);
}

/** Preserve flattened PATCH details without indexing inherited object keys. */
export function flattenZodErrors(error: import('zod').ZodError) {
  const formErrors: string[] = [];
  const fields = new Map<string, string[]>();
  for (const issue of error.issues) {
    if (issue.path.length === 0) formErrors.push(issue.message);
    else {
      const key = String(issue.path[0]);
      const messages = fields.get(key) ?? [];
      messages.push(issue.message);
      fields.set(key, messages);
    }
  }
  return { formErrors, fieldErrors: Object.fromEntries(fields) };
}

/**
 * Create a validation error response from Zod errors
 */
export function createValidationErrorResponse(error: import('zod').ZodError) {
  return createErrorResponse(
    'Validation failed',
    HTTP_STATUS.BAD_REQUEST,
    formatZodErrors(error)
  );
}

/**
 * Parse pagination parameters from URL search params
 * Enforces min/max limits and defaults
 */
export function parsePagination(searchParams: URLSearchParams): {
  page: number;
  limit: number;
  skip: number;
} {
  const page = Math.max(1, parseIntParam(searchParams.get('page'), 1));
  const limit = Math.min(
    API_CONFIG.MAX_PAGE_SIZE,
    Math.max(
      1,
      parseIntParam(searchParams.get('limit'), API_CONFIG.DEFAULT_PAGE_SIZE)
    )
  );
  const skip = (page - 1) * limit;

  return { page, limit, skip };
}
