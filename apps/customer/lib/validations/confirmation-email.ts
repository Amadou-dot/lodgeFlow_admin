import { z } from 'zod';

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
  const text = await request.text();
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch (error: unknown) {
    if (error instanceof SyntaxError)
      return { success: false, error: 'Invalid JSON body' };
    throw error;
  }

  const result = bookingConfirmationSchema.safeParse(body);
  if (!result.success)
    return { success: false, error: result.error.issues[0].message };
  return { success: true, data: result.data };
}
