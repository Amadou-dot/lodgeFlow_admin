import { getErrorMessage, isMongooseValidationError } from '@/types/errors';

describe('types/errors', () => {
  describe('getErrorMessage', () => {
    it('extracts message from Error instances', () => {
      expect(getErrorMessage(new Error('boom'))).toBe('boom');
    });

    it('extracts message from plain objects with a string message', () => {
      expect(getErrorMessage({ message: 'plain object error' })).toBe(
        'plain object error'
      );
    });

    it('returns string errors as-is', () => {
      expect(getErrorMessage('string error')).toBe('string error');
    });

    it('returns the default message for unusable values', () => {
      expect(getErrorMessage(null)).toBe('An unexpected error occurred');
      expect(getErrorMessage(undefined)).toBe('An unexpected error occurred');
      expect(getErrorMessage(42)).toBe('An unexpected error occurred');
      expect(getErrorMessage({ message: 123 })).toBe(
        'An unexpected error occurred'
      );
    });

    it('honors a custom default message', () => {
      expect(getErrorMessage(null, 'custom fallback')).toBe('custom fallback');
    });
  });

  describe('isMongooseValidationError', () => {
    it('identifies mongoose-style validation errors', () => {
      const error = new Error('Validation failed');
      error.name = 'ValidationError';
      (error as any).errors = {
        name: { message: 'Name is required' },
      };

      expect(isMongooseValidationError(error)).toBe(true);
    });

    it('rejects regular errors', () => {
      expect(isMongooseValidationError(new Error('nope'))).toBe(false);
    });

    it('rejects ValidationError-named errors without an errors bag', () => {
      const error = new Error('Validation failed');
      error.name = 'ValidationError';

      expect(isMongooseValidationError(error)).toBe(false);
    });

    it('rejects non-error values', () => {
      expect(isMongooseValidationError({ name: 'ValidationError' })).toBe(
        false
      );
      expect(isMongooseValidationError(null)).toBe(false);
    });
  });
});
