import mongoose from 'mongoose';

beforeAll(async () => {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI not set by globalSetup');
  await mongoose.connect(uri);
});

afterEach(async () => {
  const collections = mongoose.connection.collections;
  for (const key of Object.keys(collections)) {
    await collections[key].deleteMany({});
  }
});

afterAll(async () => {
  await mongoose.disconnect();
});

// Default: bypass auth in all API route tests
jest.mock('@/lib/api-utils', () => ({
  ...jest.requireActual('@/lib/api-utils'),
  requireApiAuth: jest.fn().mockResolvedValue({
    authenticated: true,
    userId: 'test-user-id',
  }),
}));

// Mock Clerk SDK
jest.mock('@clerk/nextjs/server', () => ({
  auth: jest.fn().mockResolvedValue({
    userId: 'test-user-id',
    has: jest.fn(({ role }: { role: string }) => role === 'org:admin'),
  }),
  clerkClient: jest.fn().mockResolvedValue({
    users: {
      getUser: jest.fn(),
      getUserList: jest.fn(),
      createUser: jest.fn(),
      updateUser: jest.fn(),
      deleteUser: jest.fn(),
      lockUser: jest.fn(),
      unlockUser: jest.fn(),
      updateUserMetadata: jest.fn(),
    },
  }),
}));

// Mock Clerk user helpers to avoid real API calls
jest.mock('@/lib/clerk-users', () => {
  const actual = jest.requireActual('@/lib/clerk-users');
  return {
    ...actual,
    getClerkUser: jest.fn().mockResolvedValue({
      id: 'test-user-id',
      name: 'Test User',
      email: 'test@example.com',
    }),
    getClerkUsersBatch: jest.fn().mockResolvedValue({
      users: new Map(),
      errors: 0,
    }),
  };
});
