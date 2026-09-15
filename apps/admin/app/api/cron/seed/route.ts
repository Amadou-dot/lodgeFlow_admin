import { timingSafeEqual } from 'node:crypto';
import { seedDatabase } from '@/lib/seed-database';
import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic'; // Ensure the route is not cached

function getBearerToken(authorizationHeader: string | null): string | null {
  if (!authorizationHeader) {
    return null;
  }

  const [scheme, token, ...rest] = authorizationHeader.trim().split(/\s+/);

  if (scheme?.toLowerCase() !== 'bearer' || !token || rest.length > 0) {
    return null;
  }

  return token;
}

function isAuthorizedSeedRequest(
  seedSecret: string,
  authorizationHeader: string | null
): boolean {
  const bearerToken = getBearerToken(authorizationHeader);

  if (!bearerToken) {
    return false;
  }

  const expectedSecret = Buffer.from(seedSecret);
  const receivedToken = Buffer.from(bearerToken);

  return (
    expectedSecret.length === receivedToken.length &&
    timingSafeEqual(expectedSecret, receivedToken)
  );
}

export async function GET(request: Request) {
  try {
    const seedSecret = process.env.SEED_SECRET;

    if (!seedSecret) {
      console.error('SEED_SECRET is not configured for /api/cron/seed');
      return NextResponse.json(
        {
          success: false,
          error: 'SEED_SECRET is not configured',
        },
        { status: 500 }
      );
    }

    if (
      !isAuthorizedSeedRequest(seedSecret, request.headers.get('authorization'))
    ) {
      return NextResponse.json(
        {
          success: false,
          error: 'Unauthorized',
        },
        {
          status: 401,
          headers: {
            'WWW-Authenticate': 'Bearer',
          },
        }
      );
    }

    const results = await seedDatabase();
    return NextResponse.json({
      success: true,
      message: 'Database seeded successfully',
      results,
    });
  } catch (error: unknown) {
    console.error('Error seeding database:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
