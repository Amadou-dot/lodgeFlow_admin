import { logger } from '@lodgeflow/database/logger';
import { readJsonRequestBody } from '@/lib/validations/request-body';
import { diningConfirmationSchema } from '@/lib/validations/confirmation-email';
import type { ComponentProps } from 'react';
import { getEmailSender } from '@lodgeflow/email';
import { getResend } from '@/lib/resend';

import { DiningReservationConfirmationEmail } from '@/components/EmailTemplates';
import { connectDB, DiningReservation } from '@lodgeflow/database';
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

    const json = await readJsonRequestBody(request);
    if (!json.success)
      return Response.json({ error: json.error }, { status: 400 });
    const parsed = diningConfirmationSchema.safeParse(json.data);
    if (!parsed.success)
      return Response.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      );
    const { reservationId } = parsed.data;

    await connectDB();

    const reservation = await DiningReservation.findById(
      reservationId
    ).populate<{
      dining:
        | ComponentProps<
            typeof DiningReservationConfirmationEmail
          >['diningData']
        | null;
    }>('dining');
    if (!reservation) {
      return Response.json({ error: 'Reservation not found' }, { status: 404 });
    }

    if (reservation.customer !== userId) {
      return Response.json(
        { error: 'Not authorized to send this confirmation' },
        { status: 403 }
      );
    }

    if (!reservation.isPaid && reservation.totalPrice > 0)
      return Response.json(
        { error: 'Payment is required before confirmation' },
        { status: 409 }
      );

    const user = await currentUser();
    const email = user?.emailAddresses?.[0]?.emailAddress;
    const firstName = user?.firstName || 'Guest';

    if (!email || !validateEmail(email)) {
      return Response.json({ error: 'Invalid email address' }, { status: 400 });
    }

    if (!reservation.dining)
      return Response.json({ error: 'Dining item not found' }, { status: 404 });

    const { data, error } = await getResend().emails.send({
      from: getEmailSender({
        kind: reservation.totalPrice > 0 ? 'payment' : 'notification',
      }),
      react: DiningReservationConfirmationEmail({
        date: reservation.date.toISOString(),
        diningData: reservation.dining,
        firstName,
        numGuests: reservation.numGuests,
        occasion: reservation.occasion,
        reservationId: reservation._id.toString(),
        tablePreference: reservation.tablePreference,
        time: reservation.time,
        totalPrice: reservation.totalPrice,
      }),
      subject: 'Dining Reservation Confirmation - LodgeFlow',
      to: `${email}`,
    });

    if (error) {
      logger.error('Confirmation provider rejected the send', error, {
        route: 'dining-confirm',
      });
      return Response.json(
        { error: 'Failed to send confirmation email' },
        { status: 500 }
      );
    }

    return Response.json(data);
  } catch (error: unknown) {
    logger.error('Confirmation request failed', error, {
      route: 'dining-confirm',
    });
    return Response.json(
      { error: 'Failed to send confirmation email' },
      { status: 500 }
    );
  }
}
