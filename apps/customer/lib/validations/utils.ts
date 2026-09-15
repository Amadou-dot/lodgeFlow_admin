import { NextResponse } from 'next/server';
import { z } from 'zod';

import type { ApiResponse } from '@/types';

/**
 * Validates request body or query params against a Zod schema
 * Returns validation result with formatted error messages
 */
export function validateRequest<T extends z.ZodType>(
  schema: T,
  data: unknown
): { success: true; data: z.infer<T> } | { success: false; error: string } {
  try {
    const validatedData = schema.parse(data);
    return { success: true, data: validatedData };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessage = error.issues
        .map(
          err =>
            `${err.path.length > 0 ? `${err.path.join('.')}: ` : ''}${err.message}`
        )
        .join(', ');
      return { success: false, error: errorMessage };
    }
    return { success: false, error: 'Validation failed' };
  }
}

/**
 * Creates a standardized validation error response
 */
export function validationErrorResponse(error: string) {
  const response: ApiResponse<never> = {
    success: false,
    error,
  };
  return NextResponse.json(response, { status: 400 });
}
