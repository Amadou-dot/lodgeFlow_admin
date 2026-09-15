import { requireApiAuth } from '@/lib/api-utils';
import { getClerkUsers } from '@/lib/clerk-users';
import connectDB from '@/lib/mongodb';
import Booking from '@/models/Booking';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  // Require authentication - prevents email enumeration attacks
  const authResult = await requireApiAuth();
  if (!authResult.authenticated) return authResult.error;

  try {
    await connectDB();

    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');

    if (!email) {
      return NextResponse.json(
        { success: false, error: 'Email parameter is required' },
        { status: 400 }
      );
    }

    // First, find the Clerk user by email
    const clerkUserResponse = await getClerkUsers({
      emailAddress: [email],
      limit: 1,
    });

    if (!clerkUserResponse.data || clerkUserResponse.data.length === 0) {
      return NextResponse.json(
        { success: false, error: 'User not found for this email' },
        { status: 404 }
      );
    }

    const clerkUserId = clerkUserResponse.data[0].id;

    // Now find booking by the Clerk user ID
    const booking = await Booking.findOne({ customer: clerkUserId })
      .populate('cabin')
      .sort({ createdAt: -1 }) // Get the most recent booking for this user
      .lean();

    if (!booking) {
      return NextResponse.json(
        { success: false, error: 'Booking not found for this email' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: booking,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
