import { getEmailSender } from '@lodgeflow/email';
import { createRateLimitResponse, requireApiAuth } from '@/lib/api-utils';
import {
  checkRateLimit,
  createRateLimitKey,
  RATE_LIMIT_CONFIGS,
} from '@/lib/rate-limit';
import { BookingConfirmationEmail } from '@/components/EmailTemplates';
import { validateEmail } from '@/utils/utilityFunctions';
import { getResend } from '@/lib/resend';

export async function POST(request: Request) {
  // Require authentication - prevents email spam abuse
  const authResult = await requireApiAuth({ permission: 'bookings:manage' });
  if (!authResult.authenticated) return authResult.error;

  // Rate limit email sending (stricter limits)
  const rateLimitKey = createRateLimitKey(authResult.userId, 'send-confirm');
  const rateLimitResult = await checkRateLimit(
    rateLimitKey,
    RATE_LIMIT_CONFIGS.EMAIL
  );
  if (!rateLimitResult.success) {
    return createRateLimitResponse(rateLimitResult.resetTime);
  }

  const { firstName, email, bookingData, cabinData } = await request.json();
  const emailValid = validateEmail(email);
  try {
    if (!emailValid) {
      return Response.json({ error: 'Invalid email address' }, { status: 400 });
    }

    if (!bookingData || !cabinData) {
      return Response.json(
        { error: 'Missing booking or cabin data' },
        { status: 400 }
      );
    }

    const { data, error } = await getResend().emails.send({
      from: getEmailSender({ kind: 'notification' }),
      to: `${email}`,
      subject: 'Booking Confirmation',
      react: BookingConfirmationEmail({
        firstName,
        bookingData,
        cabinData,
      }),
    });

    if (error) {
      return Response.json({ error }, { status: 500 });
    }

    return Response.json(data);
  } catch (error) {
    return Response.json({ error }, { status: 500 });
  }
}
