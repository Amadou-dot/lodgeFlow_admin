// Mock @tanstack/react-query before imports
let capturedMutationConfig: any = null;

jest.mock('@tanstack/react-query', () => ({
  useMutation: jest.fn((config: any) => {
    capturedMutationConfig = config;
    return {
      mutate: jest.fn(),
      mutateAsync: jest.fn(),
      isPending: false,
      isError: false,
      isSuccess: false,
      reset: jest.fn(),
    };
  }),
  useQueryClient: jest.fn(() => ({ invalidateQueries: jest.fn() })),
}));

import {
  useCreateCustomer,
  useDeleteCustomer,
  useLockCustomer,
  useUnlockCustomer,
  useUpdateCustomer,
} from '@/hooks/useCustomers';

beforeEach(() => {
  capturedMutationConfig = null;
  jest.clearAllMocks();
  (global.fetch as jest.Mock) = jest.fn();
});

describe('useCreateCustomer', () => {
  const customer = { first_name: 'Jane', email: 'jane@example.com' };

  it('POSTs the customer payload and returns the created customer', async () => {
    const created = { id: 'user_1', ...customer };
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true, data: created }),
    });

    useCreateCustomer();
    const result = await capturedMutationConfig.mutationFn(customer);

    expect(global.fetch).toHaveBeenCalledWith('/api/customers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(customer),
    });
    expect(result).toEqual(created);
  });

  it('throws the API error message on HTTP failure', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: 'Email already exists' }),
    });

    useCreateCustomer();

    await expect(capturedMutationConfig.mutationFn(customer)).rejects.toThrow(
      'Email already exists'
    );
  });

  it('throws when the API reports success:false', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: false, error: 'Rejected' }),
    });

    useCreateCustomer();

    await expect(capturedMutationConfig.mutationFn(customer)).rejects.toThrow(
      'Rejected'
    );
  });
});

describe('useUpdateCustomer', () => {
  it('PUTs to the customer-specific endpoint', async () => {
    const update = { id: 'user_1', first_name: 'Janet' };
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true, data: update }),
    });

    useUpdateCustomer();
    const result = await capturedMutationConfig.mutationFn(update);

    expect(global.fetch).toHaveBeenCalledWith('/api/customers/user_1', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(update),
    });
    expect(result).toEqual(update);
  });

  it('throws the API error message on failure', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: 'Customer not found' }),
    });

    useUpdateCustomer();

    await expect(
      capturedMutationConfig.mutationFn({ id: 'user_x' })
    ).rejects.toThrow('Customer not found');
  });
});

describe('useDeleteCustomer', () => {
  it('DELETEs the customer by id', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true }),
    });

    useDeleteCustomer();
    const result = await capturedMutationConfig.mutationFn('user_1');

    expect(global.fetch).toHaveBeenCalledWith('/api/customers/user_1', {
      method: 'DELETE',
    });
    expect(result).toEqual({ success: true });
  });

  it('throws the API error message on failure', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: 'Cannot delete customer' }),
    });

    useDeleteCustomer();

    await expect(capturedMutationConfig.mutationFn('user_1')).rejects.toThrow(
      'Cannot delete customer'
    );
  });
});

describe('useLockCustomer / useUnlockCustomer', () => {
  it('locks via POST to the lock endpoint', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true }),
    });

    useLockCustomer();
    const result = await capturedMutationConfig.mutationFn('user_1');

    expect(global.fetch).toHaveBeenCalledWith('/api/customers/user_1/lock', {
      method: 'POST',
    });
    expect(result).toEqual({ success: true });
  });

  it('unlocks via DELETE to the lock endpoint', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true }),
    });

    useUnlockCustomer();
    const result = await capturedMutationConfig.mutationFn('user_1');

    expect(global.fetch).toHaveBeenCalledWith('/api/customers/user_1/lock', {
      method: 'DELETE',
    });
    expect(result).toEqual({ success: true });
  });

  it('throws the API error message when locking fails', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: 'Already locked' }),
    });

    useLockCustomer();

    await expect(capturedMutationConfig.mutationFn('user_1')).rejects.toThrow(
      'Already locked'
    );
  });
});
