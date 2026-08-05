// Mock Clerk SDK before importing the module under test
const mockGetUser = jest.fn();
const mockGetUserList = jest.fn();

jest.mock('@clerk/nextjs/server', () => ({
  clerkClient: jest.fn().mockResolvedValue({
    users: {
      getUser: (...args: any[]) => mockGetUser(...args),
      getUserList: (...args: any[]) => mockGetUserList(...args),
    },
  }),
  User: {},
}));

import { convertClerkUserToCustomer } from '@/lib/clerk-users';

// Inline mock Clerk user factory (avoids ESM faker import issue)
function createMockClerkUser(overrides: Record<string, any> = {}) {
  return {
    id: 'user_abc123',
    firstName: 'John',
    lastName: 'Doe',
    username: 'johndoe',
    emailAddresses: [{ id: 'email_1', emailAddress: 'john@example.com' }],
    primaryEmailAddressId: 'email_1',
    phoneNumbers: [{ phoneNumber: '+1234567890' }],
    imageUrl: 'https://example.com/avatar.jpg',
    hasImage: true,
    publicMetadata: {},
    privateMetadata: {},
    createdAt: Date.now(),
    updatedAt: Date.now(),
    lastSignInAt: Date.now(),
    lastActiveAt: Date.now(),
    banned: false,
    locked: false,
    ...overrides,
  };
}

describe('clerk-users', () => {
  describe('convertClerkUserToCustomer', () => {
    it('converts basic Clerk user to Customer', () => {
      const clerkUser = createMockClerkUser({
        id: 'user_123',
        firstName: 'John',
        lastName: 'Doe',
      });

      const customer = convertClerkUserToCustomer(clerkUser as any);

      expect(customer.id).toBe('user_123');
      expect(customer.name).toBe('John Doe');
      expect(customer.first_name).toBe('John');
      expect(customer.last_name).toBe('Doe');
    });

    it('uses username when no first/last name', () => {
      const clerkUser = createMockClerkUser({
        firstName: null,
        lastName: null,
        username: 'johndoe',
      });

      const customer = convertClerkUserToCustomer(clerkUser as any);

      expect(customer.name).toBe('johndoe');
    });

    it('falls back to "Unknown User" when no name data', () => {
      const clerkUser = createMockClerkUser({
        firstName: null,
        lastName: null,
        username: null,
      });

      const customer = convertClerkUserToCustomer(clerkUser as any);

      expect(customer.name).toBe('Unknown User');
    });

    it('extracts primary email', () => {
      const clerkUser = createMockClerkUser({
        emailAddresses: [
          { id: 'email_1', emailAddress: 'john@example.com' },
          { id: 'email_2', emailAddress: 'john2@example.com' },
        ],
        primaryEmailAddressId: 'email_1',
      });

      const customer = convertClerkUserToCustomer(clerkUser as any);

      expect(customer.email).toBe('john@example.com');
    });

    it('returns empty email when no primary email match', () => {
      const clerkUser = createMockClerkUser({
        emailAddresses: [],
        primaryEmailAddressId: 'email_999',
      });

      const customer = convertClerkUserToCustomer(clerkUser as any);

      expect(customer.email).toBe('');
    });

    it('extracts phone number', () => {
      const clerkUser = createMockClerkUser({
        phoneNumbers: [{ phoneNumber: '+1234567890' }],
      });

      const customer = convertClerkUserToCustomer(clerkUser as any);

      expect(customer.phone).toBe('+1234567890');
    });

    it('extracts public metadata', () => {
      const clerkUser = createMockClerkUser({
        publicMetadata: {
          nationality: 'US',
          preferences: {
            smokingPreference: 'non-smoking',
          },
        },
      });

      const customer = convertClerkUserToCustomer(clerkUser as any);

      expect(customer.nationality).toBe('US');
      expect(customer.preferences?.smokingPreference).toBe('non-smoking');
    });

    it('extracts private metadata and builds full address', () => {
      const clerkUser = createMockClerkUser({
        privateMetadata: {
          nationalId: 'ABC123',
          address: {
            street: '123 Main St',
            city: 'New York',
            state: 'NY',
            country: 'US',
            zipCode: '10001',
          },
        },
      });

      const customer = convertClerkUserToCustomer(clerkUser as any);

      expect(customer.nationalId).toBe('ABC123');
      expect(customer.fullAddress).toBe('123 Main St, New York, NY, US, 10001');
    });

    it('defaults totalBookings and totalSpent to 0', () => {
      const clerkUser = createMockClerkUser();
      const customer = convertClerkUserToCustomer(clerkUser as any);

      expect(customer.totalBookings).toBe(0);
      expect(customer.totalSpent).toBe(0);
    });

    it('defaults loyaltyTier to Bronze', () => {
      const clerkUser = createMockClerkUser();
      const customer = convertClerkUserToCustomer(clerkUser as any);

      expect(customer.loyaltyTier).toBe('Bronze');
    });

    it('handles missing phone numbers', () => {
      const clerkUser = createMockClerkUser({
        phoneNumbers: [],
      });

      const customer = convertClerkUserToCustomer(clerkUser as any);

      expect(customer.phone).toBeUndefined();
    });

    it('converts timestamps correctly', () => {
      const now = Date.now();
      const clerkUser = createMockClerkUser({
        createdAt: now,
        updatedAt: now,
        lastSignInAt: now,
      });

      const customer = convertClerkUserToCustomer(clerkUser as any);

      expect(customer.created_at).toBeInstanceOf(Date);
      expect(customer.updated_at).toBeInstanceOf(Date);
      expect(customer.last_sign_in_at).toBeInstanceOf(Date);
    });

    it('handles null lastSignInAt', () => {
      const clerkUser = createMockClerkUser({
        lastSignInAt: null,
      });

      const customer = convertClerkUserToCustomer(clerkUser as any);

      expect(customer.last_sign_in_at).toBeNull();
    });
  });
});
