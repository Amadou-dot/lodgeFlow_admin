import { getResend } from '@/lib/resend';

import { DiningReservationConfirmationEmail } from '@/components/EmailTemplates';
import { connectDB, DiningReservation } from '@/models';
import { auth, currentUser } from '@clerk/nextjs/server';

function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: 'Authentication required' }, { status: 401 });
  }

  const { reservationId } = await request.json();

  try {
    if (!reservationId) {
      return Response.json(
        { error: 'Reservation ID is required' },
        { status: 400 }
      );
    }

    await connectDB();

    const reservation =
      await DiningReservation.findById(reservationId).populate('dining');
    if (!reservation) {
      return Response.json({ error: 'Reservation not found' }, { status: 404 });
    }

    if (reservation.customer !== userId) {
      return Response.json(
        { error: 'Not authorized to send this confirmation' },
        { status: 403 }
      );
    }

    const user = await currentUser();
    const email = user?.emailAddresses?.[0]?.emailAddress;
    const firstName = user?.firstName || 'Guest';

    if (!email || !validateEmail(email)) {
      return Response.json({ error: 'Invalid email address' }, { status: 400 });
    }

    const { data, error } = await getResend().emails.send({
      from: 'LodgeFlow <onboarding@resend.dev>',
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
      return Response.json({ error }, { status: 500 });
    }

    return Response.json(data);
  } catch (error) {
    return Response.json({ error }, { status: 500 });
  }
}
