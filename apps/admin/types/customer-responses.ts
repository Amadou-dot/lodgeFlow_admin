import type { z } from 'zod';
import type { customersSuccessResponseSchema } from '@/lib/validations/customer-list';
import type {
  customerLockSuccessResponseSchema,
  customerUnlockSuccessResponseSchema,
} from '@/lib/validations/customer-lock';
import type {
  customerDetailSuccessResponseSchema,
  customerMutationSuccessResponseSchema,
} from '@/lib/validations/customer-responses';
import type { ApiErrorResponse } from './api-response';

export type CustomersSuccessResponse = z.output<
  typeof customersSuccessResponseSchema
>;

export type CustomersResponse = CustomersSuccessResponse | ApiErrorResponse;
export type CustomerResponse =
  z.output<typeof customerDetailSuccessResponseSchema> | ApiErrorResponse;
export type CustomerMutationResponse =
  z.output<typeof customerMutationSuccessResponseSchema> | ApiErrorResponse;
export type CustomerLockResponse =
  z.output<typeof customerLockSuccessResponseSchema> | ApiErrorResponse;
export type CustomerUnlockResponse =
  z.output<typeof customerUnlockSuccessResponseSchema> | ApiErrorResponse;
