import { requireApiAuth } from '@/lib/api-utils';
import { lockClerkUser, unlockClerkUser } from '@/lib/clerk-users';
import { getErrorMessage } from '@/types/errors';
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

    return NextResponse.json({
      success: true,
      message: 'User locked successfully',
      data: {
        locked: true,
        lockedAt: new Date().toISOString(),
      },
    });
  } catch (error: unknown) {
    console.error('Error locking user:', error);

    const errorMessage = getErrorMessage(error);
    if (errorMessage === 'User not found') {
      return NextResponse.json(
        {
          success: false,
          error: 'User not found',
        },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: errorMessage || 'Failed to lock user',
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

    return NextResponse.json({
      success: true,
      message: 'User unlocked successfully',
      data: {
        locked: false,
        unlockedAt: new Date().toISOString(),
      },
    });
  } catch (error: unknown) {
    console.error('Error unlocking user:', error);

    const errorMessage = getErrorMessage(error);
    if (errorMessage === 'User not found') {
      return NextResponse.json(
        {
          success: false,
          error: 'User not found',
        },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: errorMessage || 'Failed to unlock user',
      },
      { status: 500 }
    );
  }
}
