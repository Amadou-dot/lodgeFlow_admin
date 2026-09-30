import { logger } from '@lodgeflow/database/logger';
import { readBookingConfirmationRequest } from '@/lib/validations/confirmation-email';
import { getEmailSender } from '@lodgeflow/email';
import { getResend } from '@/lib/resend';

import { ExperienceBookingConfirmationEmail } from '@/components/EmailTemplates';
import { connectDB, ExperienceBooking } from '@lodgeflow/database';
import {
  serializeExperienceEmailBooking,
  serializeExperienceEmailExperience,
  type ExperienceConfirmationRecord,
} from '@/lib/serializers/experience-email';
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

    const booking = await ExperienceBooking.findById(bookingId)
      .populate('experience')
      .lean<ExperienceConfirmationRecord | null>();
    if (!booking) {
      return Response.json({ error: 'Booking not found' }, { status: 404 });
    }

    if (booking.customer !== userId) {
      return Response.json(
        { error: 'Not authorized to send this confirmation' },
        { status: 403 }
      );
    }

    if (!booking.isPaid && booking.totalPrice > 0)
      return Response.json(
        { error: 'Payment is required before confirmation' },
        { status: 409 }
      );

    if (!booking.experience)
      return Response.json({ error: 'Experience not found' }, { status: 404 });

    const user = await currentUser();
    const email = user?.emailAddresses?.[0]?.emailAddress;
    const firstName = user?.firstName || 'Guest';

    if (!email || !validateEmail(email)) {
      return Response.json({ error: 'Invalid email address' }, { status: 400 });
    }

    const { data, error } = await getResend().emails.send({
      from: getEmailSender({
        kind: booking.totalPrice > 0 ? 'payment' : 'notification',
      }),
      react: ExperienceBookingConfirmationEmail({
        ...serializeExperienceEmailBooking(booking),
        experienceData: serializeExperienceEmailExperience(booking.experience),
        firstName,
      }),
      subject: 'Experience Booking Confirmation - LodgeFlow',
      to: `${email}`,
    });

    if (error) {
      logger.error('Confirmation provider rejected the send', error, {
        route: 'experience-confirm',
      });
      return Response.json(
        { error: 'Failed to send confirmation email' },
        { status: 500 }
      );
    }

    return Response.json(data);
  } catch (error: unknown) {
    logger.error('Confirmation request failed', error, {
      route: 'experience-confirm',
    });
    return Response.json(
      { error: 'Failed to send confirmation email' },
      { status: 500 }
    );
  }
}
