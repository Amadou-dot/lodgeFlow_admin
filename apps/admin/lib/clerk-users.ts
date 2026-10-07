import { z } from 'zod';
import {
  customerAddressSchema,
  customerEmergencyContactSchema,
  customerPreferencesSchema,
} from '@/lib/validations/customer-metadata';
import { customerProviderError } from './customer-errors';
import type {
  CreateCustomerInput,
  UpdateCustomerInput,
  CustomerFieldChange,
} from './validations/customer';
import type {
  ClerkUserListParams,
  Customer,
  CustomerPrivateMetadata,
  CustomerPublicMetadata,
} from '@/types/clerk';
import { clerkClient, type User } from '@clerk/nextjs/server';

import { logger } from '@/lib/logger';
import { getRedisClient, REDIS_KEY_PREFIX } from '@/lib/redis';
import { customerCacheEntrySchema } from '@/lib/validations/customer-cache';

// In-memory cache for Clerk user data. Only used when Upstash is not
// configured — see lib/redis.ts for why per-instance state is not enough in
// production.
const userCache = new Map<
  string,
  { data: Customer | null; timestamp: number }
>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes in milliseconds

// Rate limiting variables
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 100; // Minimum 100ms between requests

function userCacheKey(userId: string): string {
  return `${REDIS_KEY_PREFIX}:clerk-user:${userId}`;
}

function entryToCustomer({
  entry,
  userId,
}: {
  entry: unknown;
  userId: string;
}): Customer | null | undefined {
  if (entry === null) return undefined;

  const parsed = customerCacheEntrySchema.safeParse(entry);
  if (
    !parsed.success ||
    (parsed.data.data !== null && parsed.data.data.id !== userId)
  ) {
    logger.warn('Invalid customer cache entry, treating as miss', { userId });
    return undefined;
  }

  return parsed.data.data;
}

/**
 * Read one user from the cache.
 *
 * @returns the cached `Customer`, `null` when the user is cached as
 * non-existent, or `undefined` on a miss/expiry. Redis errors are logged and
 * reported as a miss so a cache outage never fails the request.
 */
async function getCachedUser(
  userId: string
): Promise<Customer | null | undefined> {
  const redis = getRedisClient();

  if (redis) {
    try {
      const entry = await redis.get<unknown>(userCacheKey(userId));
      return entryToCustomer({ entry, userId });
    } catch (error) {
      logger.error('Redis user cache read failed, treating as miss', error, {
        userId,
      });
      return undefined;
    }
  }

  const cached = userCache.get(userId);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data;
  }
  return undefined; // Not in cache or expired
}

/**
 * Read many users from the cache in a single round trip.
 *
 * Only hits are present in the returned map; a `null` value means the user is
 * cached as non-existent.
 */
async function getCachedUsers(
  userIds: string[]
): Promise<Map<string, Customer | null>> {
  const results = new Map<string, Customer | null>();
  if (userIds.length === 0) return results;

  const redis = getRedisClient();

  if (redis) {
    try {
      const entries = await redis.mget<unknown[]>(...userIds.map(userCacheKey));

      userIds.forEach((userId, index) => {
        const customer = entryToCustomer({ entry: entries[index], userId });
        if (customer !== undefined) results.set(userId, customer);
      });

      return results;
    } catch (error) {
      logger.error('Redis user cache read failed, treating as miss', error, {
        count: userIds.length,
      });
      return results;
    }
  }

  for (const userId of userIds) {
    const cached = userCache.get(userId);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      results.set(userId, cached.data);
    }
  }

  return results;
}

async function setCachedUser(
  userId: string,
  user: Customer | null
): Promise<void> {
  const redis = getRedisClient();

  if (redis) {
    try {
      await redis.set(
        userCacheKey(userId),
        { data: user },
        { px: CACHE_DURATION }
      );
    } catch (error) {
      // A failed write only costs a future cache miss.
      logger.error('Redis user cache write failed', error, { userId });
    }
    return;
  }

  userCache.set(userId, { data: user, timestamp: Date.now() });
}

/**
 * Invalidate cache for a specific user
 */
async function invalidateCache(userId: string): Promise<void> {
  const redis = getRedisClient();

  if (redis) {
    try {
      await redis.del(userCacheKey(userId));
    } catch (error) {
      // Leaving a stale entry is bounded by the 5-minute TTL.
      logger.error('Redis user cache invalidation failed', error, { userId });
    }
    return;
  }

  userCache.delete(userId);
}

/**
 * Clear the in-memory user cache. Test-only.
 */
export function resetUserCache(): void {
  userCache.clear();
}

/**
 * Rate limiting helper with exponential backoff
 */
async function waitForRateLimit(): Promise<void> {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;
  if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
    const waitTime = MIN_REQUEST_INTERVAL - timeSinceLastRequest;
    await new Promise(resolve => setTimeout(resolve, waitTime));
  }
  lastRequestTime = Date.now();
}

/**
 * Retry mechanism with exponential backoff for rate limited requests
 */
async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  {
    maxRetries = 2,
    baseDelay = 1000,
  }: { maxRetries?: number; baseDelay?: number } = {}
): Promise<T> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error: unknown) {
      if (
        error &&
        typeof error === 'object' &&
        'status' in error &&
        error.status === 429 &&
        attempt < maxRetries
      ) {
        const delay = baseDelay * Math.pow(2, attempt); // Exponential backoff
        console.warn(
          `Rate limited, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries + 1})`
        );
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      throw error; // Re-throw if not rate limited or max retries exceeded
    }
  }
  throw new Error('Max retries exceeded');
}

export type CustomerClerkSource = Pick<
  User,
  | 'id'
  | 'firstName'
  | 'lastName'
  | 'username'
  | 'primaryEmailAddressId'
  | 'imageUrl'
  | 'hasImage'
  | 'publicMetadata'
  | 'privateMetadata'
  | 'createdAt'
  | 'updatedAt'
  | 'lastSignInAt'
  | 'lastActiveAt'
  | 'banned'
  | 'locked'
> & {
  emailAddresses: Pick<User['emailAddresses'][number], 'id' | 'emailAddress'>[];
  phoneNumbers: Pick<User['phoneNumbers'][number], 'phoneNumber'>[];
};

/**
 * Extract extended data from Clerk user metadata
 */
function metadataField<T extends z.ZodType>({
  value,
  schema,
  field,
}: {
  value: unknown;
  schema: T;
  field: string;
}): z.output<T> | undefined {
  if (value == null) return undefined;
  const result = schema.safeParse(value);
  if (result.success) return result.data;
  logger.warn('Ignoring invalid customer metadata', { field });
  return undefined;
}

function extractMetadata(clerkUser: CustomerClerkSource): {
  publicMeta: CustomerPublicMetadata;
  privateMeta: CustomerPrivateMetadata;
} {
  const publicData = clerkUser.publicMetadata ?? {};
  const privateData = clerkUser.privateMetadata ?? {};
  return {
    publicMeta: {
      nationality: metadataField({
        value: publicData.nationality,
        schema: z.string(),
        field: 'nationality',
      }),
      preferences: metadataField({
        value: publicData.preferences,
        schema: customerPreferencesSchema,
        field: 'preferences',
      }),
    },
    privateMeta: {
      nationalId: metadataField({
        value: privateData.nationalId,
        schema: z.string(),
        field: 'nationalId',
      }),
      address: metadataField({
        value: privateData.address,
        schema: customerAddressSchema,
        field: 'address',
      }),
      emergencyContact: metadataField({
        value: privateData.emergencyContact,
        schema: customerEmergencyContactSchema,
        field: 'emergencyContact',
      }),
    },
  };
}

/**
 * Converts Clerk user data to our Customer format.
 * Extended data is read from Clerk metadata (publicMetadata + privateMetadata).
 */
export function convertClerkUserToCustomer(
  clerkUser: CustomerClerkSource
): Customer {
  // Get primary email address
  const primaryEmail = clerkUser.emailAddresses.find(
    email => email.id === clerkUser.primaryEmailAddressId
  );

  // Get primary phone number (if available)
  const primaryPhone = clerkUser.phoneNumbers?.[0]?.phoneNumber;

  // Build full name from first and last name
  const name =
    [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(' ') ||
    clerkUser.username ||
    'Unknown User';

  // Extract metadata
  const { publicMeta, privateMeta } = extractMetadata(clerkUser);

  // totalBookings/totalSpent are computed on demand from Booking collection,
  // default to 0 here since they aren't stored in Clerk metadata
  const totalBookings = 0;
  const loyaltyTier: 'Bronze' | 'Silver' | 'Gold' | 'Diamond' = 'Bronze';

  // Build full address from privateMetadata
  let fullAddress = '';
  if (privateMeta.address) {
    const { street, city, state, country, zipCode } = privateMeta.address;
    fullAddress = [street, city, state, country, zipCode]
      .filter(Boolean)
      .join(', ');
  }

  return {
    // Clerk user data
    id: clerkUser.id,
    username: clerkUser.username,
    first_name: clerkUser.firstName,
    last_name: clerkUser.lastName,
    name,
    email: primaryEmail?.emailAddress || '',
    phone: primaryPhone,
    image_url: clerkUser.imageUrl,
    has_image: clerkUser.hasImage,
    created_at: new Date(clerkUser.createdAt),
    updated_at: new Date(clerkUser.updatedAt),
    last_sign_in_at: clerkUser.lastSignInAt
      ? new Date(clerkUser.lastSignInAt)
      : null,
    last_active_at: new Date(clerkUser.lastActiveAt || clerkUser.createdAt),

    // Clerk status fields
    banned: clerkUser.banned,
    locked: clerkUser.locked,
    lockout_expires_in_seconds: null,

    // Extended data from Clerk metadata
    nationality: publicMeta.nationality,
    nationalId: privateMeta.nationalId,
    address: privateMeta.address,
    emergencyContact: privateMeta.emergencyContact,
    preferences: publicMeta.preferences,

    // Computed on demand — default to 0 here
    totalBookings,
    totalSpent: 0,
    lastBookingDate: undefined,

    // Computed properties
    loyaltyTier,
    fullAddress,
  };
}

/**
 * Get a list of users from Clerk with pagination and filtering
 */
export async function getClerkUsers(params: ClerkUserListParams = {}): Promise<{
  data: Customer[];
  totalCount: number;
}> {
  try {
    const client = await clerkClient();
    const response = await client.users.getUserList({
      limit: params.limit || 10,
      offset: params.offset || 0,
      orderBy: (params.orderBy || '-created_at') as
        | '+created_at'
        | '-created_at'
        | '+updated_at'
        | '-updated_at'
        | '+email_address'
        | '-email_address'
        | '+phone_number'
        | '-phone_number'
        | '+username'
        | '-username'
        | '+first_name'
        | '-first_name'
        | '+last_name'
        | '-last_name',
      emailAddress: params.emailAddress,
      phoneNumber: params.phoneNumber,
      userId: params.userId,
      query: params.query,
    });

    // Convert Clerk users to our Customer format (metadata is already on the user object)
    const customers = response.data.map((clerkUser: User) =>
      convertClerkUserToCustomer(clerkUser)
    );

    return {
      data: customers,
      totalCount: response.totalCount,
    };
  } catch (error) {
    console.error('Error fetching users from Clerk:', error);
    throw new Error('Failed to fetch users from Clerk');
  }
}

/**
 * Get a single user from Clerk by ID
 */
export async function getClerkUser(userId: string): Promise<Customer | null> {
  // Check cache first
  const cachedUser = await getCachedUser(userId);
  if (cachedUser !== undefined) {
    return cachedUser;
  }

  try {
    const customer = await retryWithBackoff(async () => {
      await waitForRateLimit();

      const client = await clerkClient();
      const clerkUser = await client.users.getUser(userId);

      return convertClerkUserToCustomer(clerkUser);
    });

    // Cache the result
    await setCachedUser(userId, customer);

    return customer;
  } catch (error: unknown) {
    // Only return null for genuine 404 (user deleted). All other errors
    // (429 rate limit, 500+ server errors, network errors) should propagate
    // so callers can distinguish "user not found" from "Clerk is down."
    if (error && typeof error === 'object') {
      const typedError = error as {
        status?: number;
        errors?: Array<{ code?: string }>;
      };

      if (
        typedError.status === 404 ||
        typedError.errors?.[0]?.code === 'resource_not_found'
      ) {
        await setCachedUser(userId, null);
        return null;
      }
    }

    throw error;
  }
}

/**
 * Search users from Clerk with query
 */
export async function searchClerkUsers({
  query,
  limit = 10,
  offset = 0,
}: {
  query: string;
  limit?: number;
  offset?: number;
}): Promise<{ data: Customer[]; totalCount: number }> {
  return getClerkUsers({
    query,
    limit,
    offset,
    orderBy: '-created_at',
  });
}

/**
 * Batch fetch multiple Clerk users with optimized caching
 */
export async function getClerkUsersBatch(
  userIds: string[]
): Promise<{ users: Map<string, Customer | null>; errors: number }> {
  const results = new Map<string, Customer | null>();
  const uncachedIds: string[] = [];
  let errorCount = 0;

  // Check cache first for all IDs (a single round trip when Redis-backed)
  const cachedUsers = await getCachedUsers(userIds);
  for (const userId of userIds) {
    if (cachedUsers.has(userId)) {
      results.set(userId, cachedUsers.get(userId) ?? null);
    } else {
      uncachedIds.push(userId);
    }
  }

  if (uncachedIds.length === 0) {
    return { users: results, errors: 0 };
  }

  // Fetch Clerk users in batches with concurrency limit
  const CONCURRENT_LIMIT = Number(process.env.CLERK_API_CONCURRENT_LIMIT) || 3;
  const chunks: string[][] = [];

  for (let i = 0; i < uncachedIds.length; i += CONCURRENT_LIMIT) {
    chunks.push(uncachedIds.slice(i, i + CONCURRENT_LIMIT));
  }

  for (const chunk of chunks) {
    const clerkResults = await Promise.all(
      chunk.map(async userId => {
        try {
          await waitForRateLimit();
          const client = await clerkClient();
          const clerkUser = await client.users.getUser(userId);
          const customer = convertClerkUserToCustomer(clerkUser);

          await setCachedUser(userId, customer);
          return { userId, customer, failed: false };
        } catch (error: unknown) {
          console.error(`Error fetching user ${userId}:`, error);

          const is404 =
            error &&
            typeof error === 'object' &&
            'status' in error &&
            error.status === 404;

          // Only cache null for genuine 404 (user deleted).
          // Transient errors (429, 500+, network) should NOT be cached
          // so they can be retried on the next request.
          if (is404) {
            await setCachedUser(userId, null);
          }

          return { userId, customer: null, failed: !is404 };
        }
      })
    );

    for (const { userId, customer, failed } of clerkResults) {
      results.set(userId, customer);
      if (failed) errorCount++;
    }
  }

  return { users: results, errors: errorCount };
}

/**
 * Create a new user in Clerk with required fields
 */
export async function createClerkUser(userData: {
  email: string;
  phone?: string;
  password: string;
  firstName: string;
  lastName: string;
  username?: string;
}): Promise<User> {
  try {
    const client = await clerkClient();

    interface ClerkCreateUserParams {
      emailAddress: string[];
      password: string;
      firstName: string;
      lastName: string;
      phoneNumber?: string[];
      username?: string;
    }

    const createParams: ClerkCreateUserParams = {
      emailAddress: [userData.email],
      password: userData.password,
      firstName: userData.firstName,
      lastName: userData.lastName,
    };

    if (userData.phone) {
      createParams.phoneNumber = [userData.phone];
    }

    if (userData.username) {
      createParams.username = userData.username;
    }

    const clerkUser = await client.users.createUser(createParams);
    return clerkUser;
  } catch (error: unknown) {
    logger.error('Failed to create user in Clerk', error);
    throw customerProviderError({
      error,
      fallback: 'Failed to create user in Clerk',
    });
  }
}

/**
 * Update a user in Clerk
 */
export async function updateClerkUser(
  userId: string,
  userData: {
    firstName?: string;
    lastName?: string;
    username?: string;
  }
): Promise<User> {
  try {
    const client = await clerkClient();

    interface ClerkUpdateUserParams {
      firstName?: string;
      lastName?: string;
      username?: string;
    }

    const updateParams: ClerkUpdateUserParams = {
      firstName: undefined,
      lastName: undefined,
      username: undefined,
    };

    if (userData.firstName !== undefined) {
      updateParams.firstName = userData.firstName;
    }
    if (userData.lastName !== undefined) {
      updateParams.lastName = userData.lastName;
    }
    if (userData.username !== undefined) {
      updateParams.username = userData.username;
    }

    const clerkUser = await client.users.updateUser(userId, updateParams);
    return clerkUser;
  } catch (error: unknown) {
    logger.error('Failed to update user in Clerk', error);
    throw customerProviderError({
      error,
      fallback: 'Failed to update user in Clerk',
    });
  }
}

/**
 * Delete a user from Clerk
 */
export async function deleteClerkUser(userId: string): Promise<User> {
  try {
    const client = await clerkClient();
    const deletedUser = await client.users.deleteUser(userId);
    return deletedUser;
  } catch (error: unknown) {
    logger.error('Failed to delete user in Clerk', error);
    throw customerProviderError({
      error,
      fallback: 'Failed to delete user in Clerk',
    });
  }
}

/**
 * Lock a user in Clerk (prevent them from signing in)
 */
export async function lockClerkUser(userId: string): Promise<User> {
  try {
    const client = await clerkClient();
    const lockedUser = await client.users.lockUser(userId);
    return lockedUser;
  } catch (error: unknown) {
    logger.error('Failed to lock user in Clerk', error);
    throw customerProviderError({
      error,
      fallback: 'Failed to lock user in Clerk',
    });
  }
}

/**
 * Unlock a user in Clerk (allow them to sign in again)
 */
export async function unlockClerkUser(userId: string): Promise<User> {
  try {
    const client = await clerkClient();
    const unlockedUser = await client.users.unlockUser(userId);
    return unlockedUser;
  } catch (error: unknown) {
    logger.error('Failed to unlock user in Clerk', error);
    throw customerProviderError({
      error,
      fallback: 'Failed to unlock user in Clerk',
    });
  }
}

/**
 * Create a complete customer (Clerk user + metadata)
 */
export async function createCompleteCustomer(
  userData: CreateCustomerInput
): Promise<Customer> {
  try {
    // 1. Create user in Clerk
    const clerkUser = await createClerkUser({
      email: userData.email,
      phone: userData.phone,
      password: userData.password,
      firstName: userData.firstName,
      lastName: userData.lastName,
    });

    // 2. Store extended data in Clerk metadata
    const publicMetadata: CustomerPublicMetadata = {};
    const privateMetadata: CustomerPrivateMetadata = {};

    if (userData.nationality) publicMetadata.nationality = userData.nationality;
    if (userData.preferences) publicMetadata.preferences = userData.preferences;

    if (userData.nationalId) privateMetadata.nationalId = userData.nationalId;
    if (userData.address) privateMetadata.address = userData.address;
    if (userData.emergencyContact)
      privateMetadata.emergencyContact = userData.emergencyContact;

    const client = await clerkClient();
    const updatedUser = await client.users.updateUserMetadata(clerkUser.id, {
      publicMetadata,
      privateMetadata,
    });

    // 3. Return combined customer object
    return convertClerkUserToCustomer(updatedUser);
  } catch (error) {
    logger.error('Failed to create customer', error);
    throw customerProviderError({
      error,
      fallback: 'Failed to create customer',
    });
  }
}

/**
 * Delete a complete customer (Clerk user only — no more MongoDB)
 */
export async function deleteCompleteCustomer(
  clerkUserId: string
): Promise<void> {
  try {
    await deleteClerkUser(clerkUserId);
    await invalidateCache(clerkUserId);
  } catch (error) {
    logger.error('Failed to delete customer', error);
    throw error;
  }
}

/**
 * Update a complete customer (Clerk user + metadata)
 */
export async function updateCompleteCustomer(
  clerkUserId: string,
  changes: UpdateCustomerInput
): Promise<Customer> {
  try {
    const client = await clerkClient();

    // 1. Update user in Clerk (only if Clerk-related fields are provided)
    let clerkUser;
    const clerkUpdateFields = {
      firstName: changes.firstName,
      lastName: changes.lastName,
      username: changes.username,
    };

    const hasClerkUpdates = Object.values(clerkUpdateFields).some(
      value => value !== undefined
    );

    if (hasClerkUpdates) {
      clerkUser = await updateClerkUser(clerkUserId, clerkUpdateFields);
    } else {
      clerkUser = await client.users.getUser(clerkUserId);
    }

    // 2. Update extended data in Clerk metadata
    const publicMetadata: Record<string, unknown> = {};
    const privateMetadata: Record<string, unknown> = {};
    let hasMetadataUpdates = false;

    if (changes.nationality.kind !== 'unchanged') {
      publicMetadata.nationality = changeValue(changes.nationality);
      hasMetadataUpdates = true;
    }
    if (changes.preferences.kind !== 'unchanged') {
      publicMetadata.preferences = changeValue(changes.preferences);
      hasMetadataUpdates = true;
    }

    if (changes.nationalId.kind !== 'unchanged') {
      privateMetadata.nationalId = changeValue(changes.nationalId);
      hasMetadataUpdates = true;
    }
    if (changes.address.kind !== 'unchanged') {
      privateMetadata.address = changeValue(changes.address);
      hasMetadataUpdates = true;
    }
    if (changes.emergencyContact.kind !== 'unchanged') {
      privateMetadata.emergencyContact = changeValue(changes.emergencyContact);
      hasMetadataUpdates = true;
    }

    if (hasMetadataUpdates) {
      clerkUser = await client.users.updateUserMetadata(clerkUserId, {
        publicMetadata,
        privateMetadata,
      });
    }

    // Invalidate cache
    await invalidateCache(clerkUserId);

    // 3. Return updated combined customer object
    if (!clerkUser) {
      throw new Error('Failed to get updated user data');
    }

    return convertClerkUserToCustomer(clerkUser);
  } catch (error) {
    logger.error('Failed to update customer', error);
    throw customerProviderError({
      error,
      fallback: 'Failed to update customer',
    });
  }
}

function changeValue<T>(change: CustomerFieldChange<T>): T | null | undefined {
  return change.kind === 'set'
    ? change.value
    : change.kind === 'clear'
      ? null
      : undefined;
}
