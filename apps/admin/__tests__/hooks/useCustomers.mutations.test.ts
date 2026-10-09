/** @jest-environment node */
import type {
  CreateCustomerInput,
  UpdateCustomerRequest,
} from '@/lib/validations/customer';
import type { Customer } from '@/types';
type MutationInput =
  CreateCustomerInput | (UpdateCustomerRequest & { id: string }) | string;
interface MutationConfig {
  mutationFn: (input: MutationInput) => Promise<unknown>;
}
const mockFetch = jest.fn<Promise<Response>, Parameters<typeof fetch>>();
const mockMutate = jest.fn(() => Promise.resolve());

jest.mock('swr', () => ({
  useSWRConfig: () => ({ mutate: mockMutate }),
}));

// Mock @tanstack/react-query before imports
let capturedMutationConfig: MutationConfig | null = null;
function mutation(): MutationConfig {
  if (!capturedMutationConfig) throw new Error('Mutation not initialized');
  return capturedMutationConfig;
}

jest.mock('@tanstack/react-query', () => ({
  useMutation: jest.fn((config: MutationConfig) => {
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
  global.fetch = mockFetch;
  mockFetch.mockReset();
});

const customerJson: Customer = {
  id: 'user_1',
  name: 'Jane Guest',
  first_name: 'Jane',
  last_name: 'Guest',
  username: null,
  email: 'jane@example.com',
  image_url: '',
  has_image: false,
  created_at: '2030-01-01T00:00:00.000Z',
  updated_at: '2030-01-01T00:00:00.000Z',
  last_sign_in_at: null,
  last_active_at: '2030-01-01T00:00:00.000Z',
  banned: false,
  locked: false,
  lockout_expires_in_seconds: null,
  totalBookings: 0,
  totalSpent: 0,
  loyaltyTier: 'Bronze',
};

describe('useCreateCustomer', () => {
  const customer = {
    firstName: 'Jane',
    lastName: 'Guest',
    email: 'jane@example.com',
    password: 'test-password',
  } satisfies CreateCustomerInput;

  it('POSTs the customer payload and returns the created customer', async () => {
    const created = customerJson;
    mockFetch.mockResolvedValue(
      Response.json({ success: true, data: created }, { status: 200 })
    );

    useCreateCustomer();
    const result = await mutation().mutationFn(customer);

    expect(global.fetch).toHaveBeenCalledWith('/api/customers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(customer),
    });
    expect(result).toEqual(created);
  });

  it('throws the API error message on HTTP failure', async () => {
    mockFetch.mockResolvedValue(
      Response.json({ error: 'Email already exists' }, { status: 400 })
    );

    useCreateCustomer();

    await expect(mutation().mutationFn(customer)).rejects.toThrow(
      'Email already exists'
    );
  });

  it('throws when the API reports success:false', async () => {
    mockFetch.mockResolvedValue(
      Response.json({ success: false, error: 'Rejected' }, { status: 200 })
    );

    useCreateCustomer();

    await expect(mutation().mutationFn(customer)).rejects.toThrow('Rejected');
  });
});

describe('useUpdateCustomer', () => {
  it('PUTs to the customer-specific endpoint', async () => {
    const update = {
      id: 'user_1',
      firstName: 'Janet',
    } satisfies UpdateCustomerRequest & { id: string };
    mockFetch.mockResolvedValue(
      Response.json({ success: true, data: customerJson }, { status: 200 })
    );

    useUpdateCustomer();
    const result = await mutation().mutationFn(update);

    expect(global.fetch).toHaveBeenCalledWith('/api/customers/user_1', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(update),
    });
    expect(result).toEqual(customerJson);
  });

  it('throws the API error message on failure', async () => {
    mockFetch.mockResolvedValue(
      Response.json({ error: 'Customer not found' }, { status: 400 })
    );

    useUpdateCustomer();

    await expect(mutation().mutationFn({ id: 'user_x' })).rejects.toThrow(
      'Customer not found'
    );
  });
});

describe('useDeleteCustomer', () => {
  it('DELETEs the customer by id', async () => {
    mockFetch.mockResolvedValue(
      Response.json({ success: true }, { status: 200 })
    );

    useDeleteCustomer();
    const result = await mutation().mutationFn('user_1');

    expect(global.fetch).toHaveBeenCalledWith('/api/customers/user_1', {
      method: 'DELETE',
    });
    expect(result).toEqual({ success: true });
  });

  it('throws the API error message on failure', async () => {
    mockFetch.mockResolvedValue(
      Response.json({ error: 'Cannot delete customer' }, { status: 400 })
    );

    useDeleteCustomer();

    await expect(mutation().mutationFn('user_1')).rejects.toThrow(
      'Cannot delete customer'
    );
  });
});

describe('useLockCustomer / useUnlockCustomer', () => {
  it('locks via POST to the lock endpoint', async () => {
    mockFetch.mockResolvedValue(
      Response.json({ success: true }, { status: 200 })
    );

    useLockCustomer();
    const result = await mutation().mutationFn('user_1');

    expect(global.fetch).toHaveBeenCalledWith('/api/customers/user_1/lock', {
      method: 'POST',
    });
    expect(result).toEqual({ success: true });
  });

  it('unlocks via DELETE to the lock endpoint', async () => {
    mockFetch.mockResolvedValue(
      Response.json({ success: true }, { status: 200 })
    );

    useUnlockCustomer();
    const result = await mutation().mutationFn('user_1');

    expect(global.fetch).toHaveBeenCalledWith('/api/customers/user_1/lock', {
      method: 'DELETE',
    });
    expect(result).toEqual({ success: true });
  });

  it('throws the API error message when locking fails', async () => {
    mockFetch.mockResolvedValue(
      Response.json({ error: 'Already locked' }, { status: 400 })
    );

    useLockCustomer();

    await expect(mutation().mutationFn('user_1')).rejects.toThrow(
      'Already locked'
    );
  });
});
