import { z } from 'zod';
import { readJsonRequestBody } from './request-body';

export const bookingConfirmationSchema = z.object(
  {
    bookingId: z
      .string({
        error: issue =>
          issue.input == null ? 'Booking ID is required' : 'Invalid booking ID',
      })
      .min(1, 'Booking ID is required')
      .regex(/^[a-f\d]{24}$/i, 'Invalid booking ID'),
  },
  { error: 'Invalid request body' }
);

export type BookingConfirmationInput = z.infer<
  typeof bookingConfirmationSchema
>;

type ConfirmationRequestResult =
  | { success: true; data: BookingConfirmationInput }
  | { success: false; error: string };

/** Preserve the manual routes' error envelope while rejecting untrusted IDs. */
export async function readBookingConfirmationRequest(
  request: Request
): Promise<ConfirmationRequestResult> {
  const body = await readJsonRequestBody(request);
  if (!body.success) return body;

  const result = bookingConfirmationSchema.safeParse(body.data);
  if (!result.success)
    return { success: false, error: result.error.issues[0].message };
  return { success: true, data: result.data };
}

export const diningConfirmationSchema = z.object(
  {
    reservationId: z
      .string({
        error: issue =>
          issue.input == null
            ? 'Reservation ID is required'
            : 'Invalid reservation ID',
      })
      .min(1, 'Reservation ID is required')
      .regex(/^[a-f\d]{24}$/i, 'Invalid reservation ID'),
  },
  { error: 'Invalid request body' }
);
