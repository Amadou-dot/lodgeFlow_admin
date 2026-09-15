import { createClerkClient } from '@clerk/backend';
import { config } from 'dotenv';
import { resolve } from 'path';

// Load environment variables from .env.local
config({ path: resolve(process.cwd(), '.env.local') });

// Verify environment variables are loaded
console.log('🔧 Environment check:');
console.log('- CLERK_SECRET_KEY present:', !!process.env.CLERK_SECRET_KEY);
console.log(
  '- CLERK_SECRET_KEY starts with sk_:',
  process.env.CLERK_SECRET_KEY?.startsWith('sk_')
);

interface ClerkUserInfo {
  id: string;
  emailAddress: string;
  firstName: string | null;
  lastName: string | null;
  profileImageUrl: string;
  createdAt: number;
  updatedAt: number;
}

async function getClerkUsers(): Promise<ClerkUserInfo[]> {
  try {
    // Verify the secret key is available
    if (!process.env.CLERK_SECRET_KEY) {
      throw new Error('CLERK_SECRET_KEY environment variable is not set');
    }

    console.log('📋 Fetching users from Clerk...');

    const client = createClerkClient({
      secretKey: process.env.CLERK_SECRET_KEY,
    });

    // Get the list of users with pagination support
    const response = await client.users.getUserList({
      limit: 100, // Get up to 100 users
      offset: 0,
    });

    console.log(`✅ Found ${response.data.length} users in Clerk`);

    // Transform the response to our simplified format
    const users: ClerkUserInfo[] = response.data.map(user => ({
      id: user.id,
      emailAddress:
        user.emailAddresses.find(
          email => email.id === user.primaryEmailAddressId
        )?.emailAddress || 'No email',
      firstName: user.firstName,
      lastName: user.lastName,
      profileImageUrl: user.imageUrl,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    }));

    return users;
  } catch (error) {
    console.error('❌ Error fetching Clerk users:', error);
    throw error;
  }
}

// Export the function for use in other scripts
export { getClerkUsers };

// Run the script if executed directly
if (require.main === module) {
  (async () => {
    try {
      const users = await getClerkUsers();

      console.log('\n📊 User Summary:');
      console.log(`Total users: ${users.length}`);

      if (users.length > 0) {
        console.log('\n👥 Users:');
        users.forEach((user, index) => {
          const name =
            [user.firstName, user.lastName].filter(Boolean).join(' ') ||
            'No name';
          console.log(
            `${index + 1}. ${name} (${user.emailAddress}) - ID: ${user.id}`
          );
        });

        // Save to JSON file for reference
        const fs = await import('fs/promises');
        await fs.writeFile(
          'clerk-users-list.json',
          JSON.stringify(users, null, 2),
          'utf-8'
        );
        console.log('\n💾 User data saved to clerk-users-list.json');

        // Also save just the IDs for easy use in seed script
        const userIds = users.map(user => user.id);
        await fs.writeFile(
          'clerk-user-ids.json',
          JSON.stringify(userIds, null, 2),
          'utf-8'
        );
        console.log('💾 User IDs saved to clerk-user-ids.json');
      } else {
        console.log('⚠️  No users found in Clerk');
      }
    } catch (error) {
      console.error('❌ Script failed:', error);
      process.exit(1);
    }
  })();
}
