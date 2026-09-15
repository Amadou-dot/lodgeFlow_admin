import { clerkClient } from '@clerk/nextjs/server';
import { DiningReservation, ExperienceBooking } from '@lodgeflow/database';
import {
  DiningReservationConfirmationEmail,
  ExperienceBookingConfirmationEmail,
} from '@/components/EmailTemplates';
import { getResend } from './resend';

/** Called after durable payment settlement; webhook retries recover failed delivery. */
export async function sendReservationConfirmation({
  kind,
  id,
}: {
  kind: 'dining' | 'experience';
  id: string;
}) {
  const Model = kind === 'dining' ? DiningReservation : ExperienceBooking;
  const row = await Model.findById(id).populate(
    kind === 'dining' ? 'dining' : 'experience'
  );
  if (
    !row ||
    !row.isPaid ||
    row.paymentConfirmationSentAt ||
    row.status === 'cancelled'
  )
    return;
  const user = await (await clerkClient()).users.getUser(row.customer);
  const email =
    user.emailAddresses.find(
      address => address.id === user.primaryEmailAddressId
    )?.emailAddress ?? user.emailAddresses[0]?.emailAddress;
  if (!email) throw new Error('Customer has no email address');
  const firstName = user.firstName || 'Guest';
  const react =
    kind === 'dining'
      ? DiningReservationConfirmationEmail({
          reservationId: id,
          date: row.date.toISOString(),
          diningData: row.dining,
          firstName,
          numGuests: row.numGuests,
          occasion: row.occasion,
          tablePreference: row.tablePreference,
          time: row.time,
          totalPrice: row.totalPrice,
        })
      : ExperienceBookingConfirmationEmail({
          bookingId: id,
          date: row.date.toISOString(),
          experienceData: row.experience,
          firstName,
          numParticipants: row.numParticipants,
          timeSlot: row.timeSlot,
          totalPrice: row.totalPrice,
        });
  const result = await getResend().emails.send(
    {
      from: 'LodgeFlow <onboarding@resend.dev>',
      to: email,
      subject: `${kind === 'dining' ? 'Dining Reservation' : 'Experience Booking'} Confirmation - LodgeFlow`,
      react,
    },
    { idempotencyKey: `reservation-confirmation:${kind}:${id}` }
  );
  if (result.error) throw new Error(result.error.message);
  await Model.updateOne(
    { _id: id },
    { $set: { paymentConfirmationSentAt: new Date() }, $inc: { __v: 1 } }
  );
}
