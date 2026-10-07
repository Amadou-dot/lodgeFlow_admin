import { z } from 'zod';

export class CustomerProviderError extends Error {
  readonly kind: 'not-found' | 'conflict' | 'failure';
  constructor({
    kind,
    message,
  }: {
    kind: CustomerProviderError['kind'];
    message: string;
  }) {
    super(message);
    this.name = 'CustomerProviderError';
    this.kind = kind;
    Object.setPrototypeOf(this, CustomerProviderError.prototype);
  }
}

const providerErrorSchema = z.object({
  status: z.number().optional(),
  errors: z.array(z.object({ code: z.string() })).optional(),
});

/** Clerk documents duplicate identifiers as 422/form_identifier_exists.
 * https://clerk.com/docs/guides/development/errors/backend-api#formidentifierexists
 */
export function customerProviderError({
  error,
  fallback,
}: {
  error: unknown;
  fallback: string;
}): CustomerProviderError {
  if (error instanceof CustomerProviderError) return error;
  const parsed = providerErrorSchema.safeParse(error);
  if (parsed.success) {
    if (parsed.data.status === 404)
      return new CustomerProviderError({
        kind: 'not-found',
        message: 'User not found',
      });
    if (
      parsed.data.status === 409 ||
      parsed.data.errors?.some(item => item.code === 'form_identifier_exists')
    ) {
      return new CustomerProviderError({
        kind: 'conflict',
        message: 'Customer already exists',
      });
    }
  }
  return new CustomerProviderError({ kind: 'failure', message: fallback });
}
