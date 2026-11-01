import { isCustomersSuccessResponse } from './validations/customer-list';
import type { CustomersSuccessResponse } from '@/types/customer-responses';

export async function fetchCustomersList(
  url: string
): Promise<CustomersSuccessResponse> {
  const response = await fetch(url);
  if (!response.ok) throw new Error('Failed to fetch customers');

  let result: unknown;
  try {
    result = await response.json();
  } catch {
    throw new Error('Failed to fetch customers');
  }
  if (!isCustomersSuccessResponse(result)) {
    throw new Error('Failed to fetch customers');
  }
  return result;
}
