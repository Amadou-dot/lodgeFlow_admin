import { getEmailSender } from '@lodgeflow/email';
import { clerkClient } from '@clerk/nextjs/server';
import { DiningReservation, ExperienceBooking } from '@lodgeflow/database';
import type { IDiningReservation } from '@lodgeflow/database';
import type { ComponentProps } from 'react';
import {
  DiningReservationConfirmationEmail,
  ExperienceBookingConfirmationEmail,
} from '@/components/EmailTemplates';
import { getResend } from './resend';
import {
  serializeExperienceEmailBooking,
  serializeExperienceEmailExperience,
  type ExperienceConfirmationRecord,
} from './serializers/experience-email';

type DiningEmailData = ComponentProps<
  typeof DiningReservationConfirmationEmail
>['diningData'];

type DiningConfirmationRecord = Pick<
  IDiningReservation,
  | 'customer'
  | 'date'
  | 'time'
  | 'numGuests'
  | 'totalPrice'
  | 'occasion'
  | 'tablePreference'
  | 'isPaid'
  | 'status'
  | 'paymentConfirmationSentAt'
> & { dining: DiningEmailData | null };

/** Called after durable payment settlement; webhook retries recover failed delivery. */
export async function sendReservationConfirmation({
  kind,
  id,
}: {
  kind: 'dining' | 'experience';
  id: string;
}) {
  const reservation =
    kind === 'dining'
      ? {
          kind,
          row: await DiningReservation.findById(id)
            .populate('dining')
            .lean<DiningConfirmationRecord | null>(),
        }
      : {
          kind,
          row: await ExperienceBooking.findById(id)
            .populate('experience')
            .lean<ExperienceConfirmationRecord | null>(),
        };
  if (
    !reservation.row ||
    !reservation.row.isPaid ||
    reservation.row.paymentConfirmationSentAt ||
    reservation.row.status === 'cancelled'
  )
    return;
  const row = reservation.row;
  const user = await (await clerkClient()).users.getUser(row.customer);
  const email =
    user.emailAddresses.find(
      address => address.id === user.primaryEmailAddressId
    )?.emailAddress ?? user.emailAddresses[0]?.emailAddress;
  if (!email) throw new Error('Customer has no email address');
  const firstName = user.firstName || 'Guest';
  const react =
    reservation.kind === 'dining'
      ? DiningReservationConfirmationEmail({
          reservationId: id,
          date: reservation.row.date.toISOString(),
          diningData: requireDiningReference(reservation.row.dining),
          firstName,
          numGuests: reservation.row.numGuests,
          occasion: reservation.row.occasion,
          tablePreference: reservation.row.tablePreference,
          time: reservation.row.time,
          totalPrice: reservation.row.totalPrice,
        })
      : ExperienceBookingConfirmationEmail({
          ...serializeExperienceEmailBooking(reservation.row),
          experienceData: serializeExperienceEmailExperience(
            reservation.row.experience
          ),
          firstName,
        });
  const result = await getResend().emails.send(
    {
      from: getEmailSender({
        kind: row.totalPrice > 0 ? 'payment' : 'notification',
      }),
      to: email,
      subject: `${kind === 'dining' ? 'Dining Reservation' : 'Experience Booking'} Confirmation - LodgeFlow`,
      react,
    },
    { idempotencyKey: `reservation-confirmation:${kind}:${id}` }
  );
  if (result.error) throw new Error(result.error.message);
  const Model = kind === 'dining' ? DiningReservation : ExperienceBooking;
  await Model.updateOne(
    { _id: id },
    { $set: { paymentConfirmationSentAt: new Date() }, $inc: { __v: 1 } }
  );
}

function requireDiningReference(
  dining: DiningEmailData | null
): DiningEmailData {
  // Preserve the existing retryable failure for a deleted dining reference.
  if (!dining) throw new TypeError('Dining item not found');
  return dining;
}
