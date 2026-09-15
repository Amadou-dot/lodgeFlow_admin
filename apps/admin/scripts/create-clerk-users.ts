import { createClerkClient } from '@clerk/backend';
import { faker } from '@faker-js/faker';
import { config } from 'dotenv';
import { resolve } from 'path';

// Load environment variables from .env.local
config({ path: resolve(process.cwd(), '.env.local') });

const BATCH_SIZE = 3;
const BATCH_DELAY_MS = 500;
const DEFAULT_USER_COUNT = 50;

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function createClerkUsers(count: number = DEFAULT_USER_COUNT) {
  if (!process.env.CLERK_SECRET_KEY) {
    throw new Error('CLERK_SECRET_KEY environment variable is not set');
  }

  const client = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });

  console.log(`👤 Creating ${count} Clerk users...`);

  const createdIds: string[] = [];

  for (let i = 0; i < count; i += BATCH_SIZE) {
    const batchSize = Math.min(BATCH_SIZE, count - i);

    const batchPromises = Array.from({ length: batchSize }, async () => {
      const firstName = faker.person.firstName();
      const lastName = faker.person.lastName();
      const email = faker.internet.email({ firstName, lastName });
      const password = faker.internet.password({ length: 12, memorable: true });

      try {
        const user = await client.users.createUser({
          emailAddress: [email],
          firstName,
          lastName,
          password,
        });

        // Build public metadata
        const publicMetadata: Record<string, unknown> = {
          nationality: faker.location.country(),
        };

        if (faker.datatype.boolean({ probability: 0.6 })) {
          publicMetadata.preferences = {
            smokingPreference: faker.helpers.arrayElement([
              'smoking',
              'non-smoking',
              'no-preference',
            ]),
            dietaryRestrictions: faker.datatype.boolean({ probability: 0.3 })
              ? faker.helpers.arrayElements(
                  [
                    'vegetarian',
                    'vegan',
                    'gluten-free',
                    'halal',
                    'kosher',
                    'nut-free',
                    'dairy-free',
                  ],
                  { min: 1, max: 2 }
                )
              : [],
            accessibilityNeeds: faker.datatype.boolean({ probability: 0.1 })
              ? faker.helpers.arrayElements(
                  [
                    'wheelchair access',
                    'ground floor',
                    'visual aids',
                    'hearing aids',
                  ],
                  { min: 1, max: 2 }
                )
              : [],
          };
        }

        // Build private metadata
        const privateMetadata: Record<string, unknown> = {};

        if (faker.datatype.boolean({ probability: 0.4 })) {
          privateMetadata.nationalId = faker.string.alphanumeric({
            length: { min: 8, max: 12 },
            casing: 'upper',
          });
        }

        if (faker.datatype.boolean({ probability: 0.7 })) {
          privateMetadata.address = {
            street: faker.location.streetAddress(),
            city: faker.location.city(),
            state: faker.location.state(),
            country: faker.location.country(),
            zipCode: faker.location.zipCode(),
          };
        }

        if (faker.datatype.boolean({ probability: 0.3 })) {
          privateMetadata.emergencyContact = {
            firstName: faker.person.firstName(),
            lastName: faker.person.lastName(),
            phone: faker.phone.number({ style: 'international' }),
            relationship: faker.helpers.arrayElement([
              'spouse',
              'parent',
              'sibling',
              'friend',
              'partner',
            ]),
          };
        }

        await client.users.updateUserMetadata(user.id, {
          publicMetadata,
          privateMetadata,
        });

        return user.id;
      } catch (err) {
        console.warn(`⚠️  Failed to create user (${email}):`, err);
        return null;
      }
    });

    const ids = (await Promise.all(batchPromises)).filter(Boolean) as string[];
    createdIds.push(...ids);

    if ((i + batchSize) % 10 === 0 || i + batchSize >= count) {
      console.log(`✅ ${createdIds.length}/${count} users created...`);
    }

    if (i + BATCH_SIZE < count) {
      await delay(BATCH_DELAY_MS);
    }
  }

  console.log(
    `🎉 Done. Created ${createdIds.length} Clerk users with extended metadata.`
  );
  return createdIds;
}

export { createClerkUsers };

if (require.main === module) {
  const count = parseInt(process.argv[2] ?? String(DEFAULT_USER_COUNT), 10);
  createClerkUsers(count)
    .then(() => process.exit(0))
    .catch(err => {
      console.error('❌ Failed:', err);
      process.exit(1);
    });
}
