import type {
  CustomerLockResponse,
  CustomerUnlockResponse,
} from '@/types/customer-responses';
import { requireApiAuth } from '@/lib/api-utils';
import { lockClerkUser, unlockClerkUser } from '@/lib/clerk-users';
import { CustomerProviderError } from '@/lib/customer-errors';
import { logger } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Require authentication
  const authResult = await requireApiAuth();
  if (!authResult.authenticated) return authResult.error;

  try {
    const { id } = await params; // This is the Clerk user ID

    // Lock the user in Clerk
    await lockClerkUser(id);

    return NextResponse.json<CustomerLockResponse>({
      success: true,
      message: 'User locked successfully',
      data: {
        locked: true,
        lockedAt: new Date().toISOString(),
      },
    });
  } catch (error: unknown) {
    logger.error('Failed to lock user', error);

    if (error instanceof CustomerProviderError && error.kind === 'not-found') {
      return NextResponse.json<CustomerLockResponse>(
        {
          success: false,
          error: 'User not found',
        },
        { status: 404 }
      );
    }

    return NextResponse.json<CustomerLockResponse>(
      {
        success: false,
        error: 'Failed to lock user',
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Require authentication
  const authResult = await requireApiAuth();
  if (!authResult.authenticated) return authResult.error;

  try {
    const { id } = await params; // This is the Clerk user ID

    // Unlock the user in Clerk
    await unlockClerkUser(id);

    return NextResponse.json<CustomerUnlockResponse>({
      success: true,
      message: 'User unlocked successfully',
      data: {
        locked: false,
        unlockedAt: new Date().toISOString(),
      },
    });
  } catch (error: unknown) {
    logger.error('Failed to unlock user', error);

    if (error instanceof CustomerProviderError && error.kind === 'not-found') {
      return NextResponse.json<CustomerUnlockResponse>(
        {
          success: false,
          error: 'User not found',
        },
        { status: 404 }
      );
    }

    return NextResponse.json<CustomerUnlockResponse>(
      {
        success: false,
        error: 'Failed to unlock user',
      },
      { status: 500 }
    );
  }
}
