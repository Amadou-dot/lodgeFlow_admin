import { getEmailSender } from '@lodgeflow/email';
import { createRateLimitResponse, requireApiAuth } from '@/lib/api-utils';
import {
  checkRateLimit,
  createRateLimitKey,
  RATE_LIMIT_CONFIGS,
} from '@/lib/rate-limit';
import { BookingConfirmationEmail } from '@/components/EmailTemplates';
import { confirmationEmailSchema } from '@/lib/validations/confirmation-email';
import { readJsonRequestBody } from '@/lib/validations/request-body';
import { logger } from '@/lib/logger';
import { getResend } from '@/lib/resend';

export async function POST(request: Request) {
  try {
    // Require authentication - prevents email spam abuse
    const authResult = await requireApiAuth({ permission: 'bookings:manage' });
    if (!authResult.authenticated) return authResult.error;

    // Rate limit email sending (stricter limits)
    const rateLimitKey = createRateLimitKey({
      userId: authResult.userId,
      endpoint: 'send-confirm',
    });
    const rateLimitResult = await checkRateLimit(
      rateLimitKey,
      RATE_LIMIT_CONFIGS.EMAIL
    );
    if (!rateLimitResult.success) {
      return createRateLimitResponse(rateLimitResult.resetTime);
    }

    const json = await readJsonRequestBody(request);
    if (!json.success)
      return Response.json({ error: json.error }, { status: 400 });
    const parsed = confirmationEmailSchema.safeParse(json.data);
    if (!parsed.success) {
      const emailInvalid = parsed.error.issues.some(
        issue => issue.path[0] === 'email'
      );
      const missingData =
        json.data !== null &&
        typeof json.data === 'object' &&
        (!('bookingData' in json.data) ||
          !json.data.bookingData ||
          !('cabinData' in json.data) ||
          !json.data.cabinData);
      return Response.json(
        {
          error: emailInvalid
            ? 'Invalid email address'
            : missingData
              ? 'Missing booking or cabin data'
              : 'Invalid confirmation email data',
        },
        { status: 400 }
      );
    }
    const { firstName, email, bookingData, cabinData } = parsed.data;

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
