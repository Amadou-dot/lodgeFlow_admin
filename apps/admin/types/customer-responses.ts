import type { z } from 'zod';
import type { customersSuccessResponseSchema } from '@/lib/validations/customer-list';
import type { ApiErrorResponse, ApiResponse } from './api-response';
import type { CustomerJson } from './customer-json';
import type { CustomerWithStats } from './index';

export type CustomersSuccessResponse = z.output<
  typeof customersSuccessResponseSchema
>;

export type CustomersResponse = CustomersSuccessResponse | ApiErrorResponse;
export type CustomerResponse = ApiResponse<CustomerWithStats>;
export type CustomerMutationResponse = ApiResponse<CustomerJson>;
export type CustomerLockResponse = ApiResponse<{
  locked: true;
  lockedAt: string;
}>;
export type CustomerUnlockResponse = ApiResponse<{
  locked: false;
  unlockedAt: string;
}>;
