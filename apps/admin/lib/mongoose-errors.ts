import { Error as MongooseError } from 'mongoose';

export function isMongooseValidationError(
  error: unknown
): error is MongooseError.ValidationError {
  return error instanceof MongooseError.ValidationError;
}

/** Keep field feedback without serializing stored values or validator internals. */
export function mongooseValidationDetails(
  error: MongooseError.ValidationError
) {
  return Object.fromEntries(
    Object.keys(error.errors).map(path => [
      path,
      { message: 'Invalid value', path },
    ])
  );
}
