import { getEmailSender } from '@lodgeflow/email';
import { createRateLimitResponse, requireApiAuth } from '@/lib/api-utils';
import {
  checkRateLimit,
  createRateLimitKey,
  RATE_LIMIT_CONFIGS,
} from '@/lib/rate-limit';
import { WelcomeEmail } from '@/components/EmailTemplates';
import { getResend } from '@/lib/resend';
import { logger } from '@/lib/logger';
import { readWelcomeEmailRequest } from '@/lib/validations/welcome-email';

export async function POST(request: Request) {
  try {
    // The default authorization contract is application administrators only.
    const authResult = await requireApiAuth();
    if (!authResult.authenticated) return authResult.error;

    const rateLimitKey = createRateLimitKey({
      userId: authResult.userId,
      endpoint: 'send-welcome',
    });
    const rateLimitResult = await checkRateLimit(
      rateLimitKey,
      RATE_LIMIT_CONFIGS.EMAIL
    );
    if (!rateLimitResult.success) {
      return createRateLimitResponse(rateLimitResult.resetTime);
    }

    const input = await readWelcomeEmailRequest(request);
    if (!input.success)
      return Response.json({ error: input.error }, { status: 400 });
    const { firstName, email } = input.data;

    const { data, error } = await getResend().emails.send({
      from: getEmailSender({ kind: 'notification' }),
      to: email,
      subject: 'Welcome to LodgeFlow',
      react: WelcomeEmail({ firstName }),
    });

    if (error) {
      logger.error('Welcome provider rejected the send', error, {
        route: 'welcome',
      });
      return Response.json(
        { error: 'Failed to send welcome email' },
        { status: 500 }
      );
    }

    return Response.json(data);
  } catch (error: unknown) {
    logger.error('Welcome request failed', error, { route: 'welcome' });
    return Response.json(
      { error: 'Failed to send welcome email' },
      { status: 500 }
    );
  }
}
