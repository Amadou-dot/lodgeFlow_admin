import {
  createCompleteCustomer,
  updateCompleteCustomer,
  deleteCompleteCustomer,
  lockClerkUser,
  unlockClerkUser,
  type CustomerClerkSource,
} from '@/lib/clerk-users';
import { CustomerProviderError } from '@/lib/customer-errors';
import {
  createCustomerSchema,
  updateCustomerSchema,
} from '@/lib/validations/customer';

const customer: CustomerClerkSource = {
  id: 'user_guest',
  firstName: 'Test',
  lastName: 'Guest',
  username: null,
  emailAddresses: [{ id: 'email_1', emailAddress: 'test@example.invalid' }],
  primaryEmailAddressId: 'email_1',
  phoneNumbers: [],
  imageUrl: '',
  hasImage: false,
  createdAt: 1700000000000,
  updatedAt: 1700000000000,
  lastSignInAt: null,
  lastActiveAt: null,
  banned: false,
  locked: false,
  publicMetadata: {},
  privateMetadata: {},
};
const mockGet = jest.fn<Promise<CustomerClerkSource>, [string]>();
const mockCreate = jest.fn<Promise<CustomerClerkSource>, [unknown]>();
const mockUpdate = jest.fn<Promise<CustomerClerkSource>, [string, unknown]>();
const mockMetadata = jest.fn<Promise<CustomerClerkSource>, [string, unknown]>();
const mockDelete = jest.fn<Promise<CustomerClerkSource>, [string]>();
const mockLock = jest.fn<Promise<CustomerClerkSource>, [string]>();
const mockUnlock = jest.fn<Promise<CustomerClerkSource>, [string]>();
const mockInvalidate = jest.fn();
jest.mock('@clerk/nextjs/server', () => ({
  clerkClient: async () => ({
    users: {
      getUser: mockGet,
      createUser: mockCreate,
      updateUser: mockUpdate,
      updateUserMetadata: mockMetadata,
      deleteUser: mockDelete,
      lockUser: mockLock,
      unlockUser: mockUnlock,
    },
  }),
}));
jest.mock('@/lib/redis', () => ({
  REDIS_KEY_PREFIX: 'lodgeflow',
  getRedisClient: () => ({ del: mockInvalidate }),
}));
beforeEach(() => {
  jest.clearAllMocks();
  for (const dependency of [
    mockGet,
    mockCreate,
    mockUpdate,
    mockMetadata,
    mockDelete,
    mockLock,
    mockUnlock,
  ])
    dependency.mockResolvedValue(customer);
});

test('create preserves provider identity fields and public/private metadata separation', async () => {
  const input = createCustomerSchema.parse({
    firstName: 'Test',
    lastName: 'Guest',
    email: 'test@example.invalid',
    password: 'test-password',
    phone: '18005551234',
    nationality: 'USA',
    nationalId: 'ABC123',
    preferences: {
      smokingPreference: 'non-smoking',
      accessibilityNeeds: ['Step-free'],
    },
    emergencyContact: { firstName: 'Emergency', phone: '18005550000' },
  });
  const result = await createCompleteCustomer(input);
  expect(mockCreate).toHaveBeenCalledWith({
    emailAddress: [input.email],
    password: input.password,
    firstName: input.firstName,
    lastName: input.lastName,
    phoneNumber: [input.phone],
  });
  expect(mockMetadata).toHaveBeenCalledWith(customer.id, {
    publicMetadata: { nationality: 'USA', preferences: input.preferences },
    privateMetadata: {
      nationalId: 'ABC123',
      emergencyContact: input.emergencyContact,
    },
  });
  expect(result.created_at).toEqual(new Date(customer.createdAt));
});

test('omitted update fields retain existing identity and metadata', async () => {
  await updateCompleteCustomer(customer.id, updateCustomerSchema.parse({}));
  expect(mockGet).toHaveBeenCalledWith(customer.id);
  expect(mockUpdate).not.toHaveBeenCalled();
  expect(mockMetadata).not.toHaveBeenCalled();
  expect(mockInvalidate).toHaveBeenCalledWith(
    `lodgeflow:clerk-user:${customer.id}`
  );
});

test('partial update sends only selected values and invalidates cached customer', async () => {
  await updateCompleteCustomer(
    customer.id,
    updateCustomerSchema.parse({
      firstName: 'Changed',
      address: { city: 'Forest' },
      preferences: { dietaryRestrictions: ['Vegan'] },
    })
  );
  expect(mockUpdate).toHaveBeenCalledWith(customer.id, {
    firstName: 'Changed',
    lastName: undefined,
    username: undefined,
  });
  expect(mockMetadata).toHaveBeenCalledWith(customer.id, {
    publicMetadata: { preferences: { dietaryRestrictions: ['Vegan'] } },
    privateMetadata: { address: { city: 'Forest' } },
  });
  expect(mockInvalidate).toHaveBeenCalledTimes(1);
});

test('explicit null clears whole or nested metadata keys without changing omitted keys', async () => {
  await updateCompleteCustomer(
    customer.id,
    updateCustomerSchema.parse({
      nationality: null,
      nationalId: null,
      address: { city: null },
      preferences: null,
      emergencyContact: { phone: null },
    })
  );
  expect(mockUpdate).not.toHaveBeenCalled();
  expect(mockMetadata).toHaveBeenCalledWith(customer.id, {
    publicMetadata: { nationality: null, preferences: null },
    privateMetadata: {
      nationalId: null,
      address: { city: null },
      emergencyContact: { phone: null },
    },
  });
});

test('metadata provider failure does not report success or invalidate as if updated', async () => {
  mockMetadata.mockRejectedValueOnce(new Error('private provider detail'));
  await expect(
    updateCompleteCustomer(
      customer.id,
      updateCustomerSchema.parse({ nationality: 'USA' })
    )
  ).rejects.toMatchObject({
    name: 'CustomerProviderError',
    kind: 'failure',
    message: 'Failed to update customer',
  });
  expect(mockInvalidate).not.toHaveBeenCalled();
});

test('duplicate identifiers use the documented provider code and a typed conflict', async () => {
  mockCreate.mockRejectedValueOnce({
    status: 422,
    errors: [
      { code: 'form_identifier_exists', message: 'private provider detail' },
    ],
  });
  const input = createCustomerSchema.parse({
    firstName: 'Test',
    lastName: 'Guest',
    email: 'test@example.invalid',
    password: 'test-password',
  });
  await expect(createCompleteCustomer(input)).rejects.toBeInstanceOf(
    CustomerProviderError
  );
  expect(mockMetadata).not.toHaveBeenCalled();
});

test.each(['lock', 'unlock'])(
  '%s uses provider status for missing users, never message matching',
  async operation => {
    const dependency = operation === 'lock' ? mockLock : mockUnlock;
    const execute = operation === 'lock' ? lockClerkUser : unlockClerkUser;
    dependency.mockRejectedValueOnce({
      status: 404,
      errors: [{ code: 'resource_not_found' }],
    });
    await expect(execute(customer.id)).rejects.toMatchObject({
      name: 'CustomerProviderError',
      kind: 'not-found',
      message: 'User not found',
    });
    dependency.mockRejectedValueOnce(
      new Error('not found in private connection details')
    );
    await expect(execute(customer.id)).rejects.toMatchObject({
      kind: 'failure',
    });
  }
);

test('delete invalidates the customer cache only after provider success', async () => {
  await deleteCompleteCustomer(customer.id);
  expect(mockDelete).toHaveBeenCalledWith(customer.id);
  expect(mockInvalidate).toHaveBeenCalledTimes(1);
  mockDelete.mockRejectedValueOnce(new Error('private provider detail'));
  await expect(deleteCompleteCustomer(customer.id)).rejects.toBeInstanceOf(
    CustomerProviderError
  );
  expect(mockInvalidate).toHaveBeenCalledTimes(1);
});
