/** @jest-environment node */
import type {
  CreateCustomerInput,
  UpdateCustomerRequest,
} from '@/lib/validations/customer';
import { customerJsonFixture } from '../setup/customer-json';
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

const createInput: CreateCustomerInput = {
  firstName: 'Jane',
  lastName: 'Guest',
  email: 'jane@example.com',
  password: 'test-password',
};

const customerJson = {
  ...customerJsonFixture,
  name: 'Jane Guest',
  id: 'user_1',
  totalSpent: -10.125,
  nationalId: 'legacy-id',
  emergencyContact: { name: 'Legacy contact', future: 'retained' },
  future: 'retained',
};

describe('useCreateCustomer', () => {
  it('POSTs the customer payload and returns the created customer', async () => {
    const created = customerJson;
    mockFetch.mockResolvedValue(
      Response.json({
        success: true,
        data: created,
        message: 'Customer created successfully',
        future: true,
      })
    );

    useCreateCustomer();
    const result = await mutation().mutationFn(createInput);

    expect(global.fetch).toHaveBeenCalledWith('/api/customers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(createInput),
    });
    expect(result).toEqual(created);
  });

  it('throws the API error message on HTTP failure', async () => {
    mockFetch.mockResolvedValue(
      Response.json({ error: 'Email already exists' }, { status: 400 })
    );

    useCreateCustomer();

    await expect(mutation().mutationFn(createInput)).rejects.toThrow(
      'Email already exists'
    );
  });

  it('throws when the API reports success:false', async () => {
    mockFetch.mockResolvedValue(
      Response.json({ success: false, error: 'Rejected' }, { status: 200 })
    );

    useCreateCustomer();

    await expect(mutation().mutationFn(createInput)).rejects.toThrow(
      'Rejected'
    );
  });

  it.each([
    { body: false, error: 'Failed to create customer' },
    { body: 'unexpected', error: 'Failed to create customer' },
    { body: { success: true }, error: 'Failed to create customer' },
    { body: { success: true, data: null }, error: 'Failed to create customer' },
    {
      body: { success: true, error: 'Legacy rejection' },
      error: 'Legacy rejection',
    },
  ])('preserves the missing-data fallback: $error', async ({ body, error }) => {
    mockFetch.mockResolvedValue(Response.json(body));
    useCreateCustomer();
    await expect(mutation().mutationFn(createInput)).rejects.toThrow(error);
  });
});

describe('useUpdateCustomer', () => {
  it.each([
    { body: false, error: 'Failed to update customer' },
    {
      body: { success: true, data: { ...customerJson, id: 'USER_1' } },
      error: 'Failed to update customer',
    },
    { body: 'unexpected', error: 'Failed to update customer' },
    { body: { success: true }, error: 'Failed to update customer' },
    { body: { success: true, data: null }, error: 'Failed to update customer' },
    {
      body: { success: true, error: 'Legacy rejection' },
      error: 'Legacy rejection',
    },
  ])('preserves the missing-data fallback: $error', async ({ body, error }) => {
    mockFetch.mockResolvedValue(Response.json(body));
    useUpdateCustomer();
    await expect(mutation().mutationFn({ id: 'user_1' })).rejects.toThrow(
      error
    );
  });
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

describe.each([
  {
    action: 'create',
    useMutation: useCreateCustomer,
    input: createInput,
    success: { success: true, data: customerJson },
  },
  {
    action: 'update',
    useMutation: useUpdateCustomer,
    input: { id: 'user_1', firstName: 'Janet' },
    success: { success: true, data: customerJson },
  },
  {
    action: 'delete',
    useMutation: useDeleteCustomer,
    input: 'user_1',
    success: { success: true },
  },
])('$action response boundary', ({ action, useMutation, input, success }) => {
  const fallback = `Failed to ${action} customer`;

  test.each([
    { label: 'null', body: null },
    { label: 'primitive', body: 42 },
    { label: 'nonliteral success', body: { ...success, success: 1 } },
    { label: 'wrong message type', body: { ...success, message: false } },
    {
      label: 'malformed error',
      body: { ...success, error: { secret: 'provider detail' } },
    },
    { label: 'empty error', body: { success: false, error: '' } },
    {
      label: 'object error',
      body: { success: false, error: { secret: 'provider detail' } },
    },
  ])('uses the safe fallback for $label', async ({ body }) => {
    mockFetch.mockResolvedValue(Response.json(body));
    useMutation();
    await expect(mutation().mutationFn(input)).rejects.toThrow(fallback);
  });

  test.each([200, 502])(
    'uses the safe fallback for invalid JSON at HTTP %s',
    async status => {
      mockFetch.mockResolvedValue(
        new Response('<html>Private error</html>', { status })
      );
      useMutation();
      await expect(mutation().mutationFn(input)).rejects.toThrow(fallback);
    }
  );

  test('uses the safe fallback for a success body on HTTP failure', async () => {
    mockFetch.mockResolvedValue(Response.json(success, { status: 500 }));
    useMutation();
    await expect(mutation().mutationFn(input)).rejects.toThrow(fallback);
  });

  test.each([
    { status: 400, body: { error: 'Rejected' } },
    { status: 200, body: { error: 'Rejected' } },
    { status: 200, body: { success: false, error: 'Rejected' } },
    { status: 200, body: { ...success, error: 'Rejected' } },
  ])(
    'retains the API error at HTTP $status for $body',
    async ({ status, body }) => {
      mockFetch.mockResolvedValue(Response.json(body, { status }));
      useMutation();
      await expect(mutation().mutationFn(input)).rejects.toThrow('Rejected');
    }
  );
});

describe.each([
  { action: 'create', useMutation: useCreateCustomer, input: createInput },
  { action: 'update', useMutation: useUpdateCustomer, input: { id: 'user_1' } },
])('$action customer JSON', ({ action, useMutation, input }) => {
  test.each([true, { ...customerJson, totalSpent: '10' }])(
    'rejects malformed customer data %p',
    async data => {
      mockFetch.mockResolvedValue(Response.json({ success: true, data }));
      useMutation();
      await expect(mutation().mutationFn(input)).rejects.toThrow(
        `Failed to ${action} customer`
      );
    }
  );
});

test('delete rejects a data-bearing success envelope', async () => {
  mockFetch.mockResolvedValue(
    Response.json({ success: true, data: customerJson })
  );
  useDeleteCustomer();
  await expect(mutation().mutationFn('user_1')).rejects.toThrow(
    'Failed to delete customer'
  );
});

describe('useLockCustomer / useUnlockCustomer', () => {
  it('locks via POST to the lock endpoint', async () => {
    mockFetch.mockResolvedValue(
      Response.json(
        {
          success: true,
          data: { locked: true, lockedAt: '2030-01-02T03:04:05.000Z' },
        },
        { status: 200 }
      )
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
      Response.json(
        {
          success: true,
          data: { locked: false, unlockedAt: '2030-01-02T03:04:05.000Z' },
        },
        { status: 200 }
      )
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
