// ============================================================================
// Error Types for API Routes
// ============================================================================

/**
 * Mongoose validation error structure
 */
export interface MongooseValidationError extends Error {
  name: 'ValidationError';
  errors: Record<
    string,
    {
      message: string;
      name: string;
      properties: Record<string, unknown>;
      kind: string;
      path: string;
      value: unknown;
    }
  >;
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Type guard to check if an error is a Mongoose validation error
 */
export function isMongooseValidationError(
  error: unknown
): error is MongooseValidationError {
  return (
    error instanceof Error &&
    error.name === 'ValidationError' &&
    'errors' in error
  );
}

/**
 * Type guard to check if an unknown value has a message property
 */
function isErrorWithMessage(error: unknown): error is { message: string } {
  return (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof (error as Record<string, unknown>).message === 'string'
  );
}

/**
 * Safely extract error message from unknown error
 * Returns a default message if extraction fails
 */
export function getErrorMessage(
  error: unknown,
  defaultMessage = 'An unexpected error occurred'
): string {
  if (isErrorWithMessage(error)) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return defaultMessage;
}
