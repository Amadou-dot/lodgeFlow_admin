import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

import { hasAuthorizedRole } from './auth-helpers';
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
  error: string | Error,
  status: number = 500,
  details?: unknown
): NextResponse<ApiErrorResponse> {
  const errorMessage = error instanceof Error ? error.message : error;

  logger.error('API Error', error instanceof Error ? error : undefined, {
    status,
    message: errorMessage,
    details,
  });

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
export interface ApiAuthResult {
  authenticated: boolean;
  userId?: string;
  error?: NextResponse<ApiErrorResponse>;
}

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
export async function requireApiAuth(): Promise<ApiAuthResult> {
  // Bypass auth in non-production environments when TESTING=true
  if (
    process.env.NODE_ENV !== 'production' &&
    process.env.NEXT_PUBLIC_TESTING === 'true'
  ) {
    return {
      authenticated: true,
      userId: 'test-user',
    };
  }

  try {
    const { userId, has, orgId } = await auth();

    if (!userId) {
      return {
        authenticated: false,
        error: createErrorResponse('Unauthorized', HTTP_STATUS.UNAUTHORIZED),
      };
    }

    if (!hasAuthorizedRole(has, orgId)) {
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
 * Handle common API errors with appropriate status codes
 */
export function handleApiError(error: unknown): NextResponse<ApiErrorResponse> {
  if (error instanceof Error) {
    // Handle specific error types
    if (error.message.includes('not found')) {
      return createErrorResponse(error, HTTP_STATUS.NOT_FOUND);
    }
    if (
      error.message.includes('unauthorized') ||
      error.message.includes('authentication')
    ) {
      return createErrorResponse(error, HTTP_STATUS.UNAUTHORIZED);
    }
    if (
      error.message.includes('forbidden') ||
      error.message.includes('permission')
    ) {
      return createErrorResponse(error, HTTP_STATUS.FORBIDDEN);
    }
    if (
      error.message.includes('validation') ||
      error.message.includes('invalid')
    ) {
      return createErrorResponse(error, HTTP_STATUS.BAD_REQUEST);
    }

    // Default to internal server error
    return createErrorResponse(error, HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }

  // Unknown error type
  return createErrorResponse(
    'An unexpected error occurred',
    HTTP_STATUS.INTERNAL_SERVER_ERROR,
    error
  );
}

/**
 * Validate required fields in request body
 */
export function validateRequiredFields<T extends Record<string, unknown>>(
  body: T,
  requiredFields: (keyof T)[]
): { isValid: boolean; missingFields: string[] } {
  const missingFields = requiredFields.filter(
    field =>
      body[field] === undefined || body[field] === null || body[field] === ''
  );

  return {
    isValid: missingFields.length === 0,
    missingFields: missingFields as string[],
  };
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
  const formatted: Record<string, string[]> = {};

  for (const issue of error.issues) {
    const path = issue.path.join('.') || '_root';
    if (!formatted[path]) {
      formatted[path] = [];
    }
    formatted[path].push(issue.message);
  }

  return formatted;
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
 * Pagination metadata interface
 */
export interface PaginationMeta {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  limit: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
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
  const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
  const limit = Math.min(
    API_CONFIG.MAX_PAGE_SIZE,
    Math.max(
      1,
      parseInt(
        searchParams.get('limit') || String(API_CONFIG.DEFAULT_PAGE_SIZE)
      )
    )
  );
  const skip = (page - 1) * limit;

  return { page, limit, skip };
}

/**
 * Build pagination metadata for API responses
 */
export function buildPaginationMeta(
  total: number,
  page: number,
  limit: number
): PaginationMeta {
  const totalPages = Math.ceil(total / limit);
  return {
    currentPage: page,
    totalPages,
    totalItems: total,
    limit,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1,
  };
}

/**
 * Create a paginated success response
 * Combines data with pagination metadata
 */
export function createPaginatedResponse<T>(
  data: T[],
  total: number,
  page: number,
  limit: number
) {
  return NextResponse.json({
    success: true,
    data,
    pagination: buildPaginationMeta(total, page, limit),
  });
}
