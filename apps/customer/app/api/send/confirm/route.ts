import { logger } from '@lodgeflow/database/logger';
import { readBookingConfirmationRequest } from '@/lib/validations/confirmation-email';
import { getEmailSender } from '@lodgeflow/email';
import { getResend } from '@/lib/resend';

import { BookingConfirmationEmail } from '@/components/EmailTemplates';
import { Booking, connectDB } from '@lodgeflow/database';
import type { BookingEmailCabin } from '@/types/booking-email';
import {
  serializeBookingEmailBooking,
  serializeBookingEmailCabin,
} from '@/lib/serializers/booking-email';
import { auth, currentUser } from '@clerk/nextjs/server';

function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export async function POST(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return Response.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const input = await readBookingConfirmationRequest(request);
    if (!input.success)
      return Response.json({ error: input.error }, { status: 400 });
    const { bookingId } = input.data;

    await connectDB();

    const booking = await Booking.findById(bookingId).populate<{
      cabin: BookingEmailCabin | null;
    }>('cabin');
    if (!booking) {
      return Response.json({ error: 'Booking not found' }, { status: 404 });
    }

    if (booking.customer !== userId) {
      return Response.json(
        { error: 'Not authorized to send this confirmation' },
        { status: 403 }
      );
    }

    if (!booking.cabin) {
      return Response.json({ error: 'Cabin not found' }, { status: 404 });
    }

    const user = await currentUser();
    const email = user?.emailAddresses?.[0]?.emailAddress;
    const firstName = user?.firstName || 'Guest';

    if (!email || !validateEmail(email)) {
      return Response.json({ error: 'Invalid email address' }, { status: 400 });
    }

    const { data, error } = await getResend().emails.send({
      from: getEmailSender({ kind: 'notification' }),
      react: BookingConfirmationEmail({
        bookingData: serializeBookingEmailBooking(booking),
        cabinData: serializeBookingEmailCabin(booking.cabin),
        firstName,
      }),
      subject: 'Booking Confirmation',
      to: `${email}`,
    });

    if (error) {
      logger.error('Confirmation provider rejected the send', error, {
        route: 'confirm',
      });
      return Response.json(
        { error: 'Failed to send confirmation email' },
        { status: 500 }
      );
    }

    return Response.json(data);
  } catch (error: unknown) {
    logger.error('Confirmation request failed', error, { route: 'confirm' });
    return Response.json(
      { error: 'Failed to send confirmation email' },
      { status: 500 }
    );
  }
}
