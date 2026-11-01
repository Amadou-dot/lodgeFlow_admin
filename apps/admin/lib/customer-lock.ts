import {
  customerLockErrorSchema,
  customerLockSuccessResponseSchema,
  customerUnlockSuccessResponseSchema,
} from './validations/customer-lock';

export async function changeCustomerLock({
  id,
  action,
}: {
  id: string;
  action: 'lock' | 'unlock';
}): Promise<{ success: true }> {
  const fallback = `Failed to ${action} customer`;
  const response = await fetch(`/api/customers/${id}/lock`, {
    method: action === 'lock' ? 'POST' : 'DELETE',
  });

  let result: unknown;
  try {
    result = await response.json();
  } catch {
    throw new Error(fallback);
  }

  const schema =
    action === 'lock'
      ? customerLockSuccessResponseSchema
      : customerUnlockSuccessResponseSchema;
  if (response.ok && schema.safeParse(result).success) return { success: true };

  const error = customerLockErrorSchema.safeParse(result);
  throw new Error(error.success ? error.data.error : fallback);
}
