import type {
  ApiErrorResponse,
  ApiResponse,
  ApiSuccessResponse,
} from './api-response';
import type { CustomerJson } from './customer-json';
import type { CustomerWithStats } from './index';

export interface CustomersSuccessResponse extends ApiSuccessResponse<
  CustomerJson[]
> {
  pagination: {
    currentPage: number;
    totalPages: number;
    totalCustomers: number;
    limit: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

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
