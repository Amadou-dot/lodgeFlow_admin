import { createRateLimitResponse, requireApiAuth } from '@/lib/api-utils';
import {
  checkRateLimit,
  createRateLimitKey,
  RATE_LIMIT_CONFIGS,
} from '@/lib/rate-limit';
import { WelcomeEmail } from '@/components/EmailTemplates';
import { validateEmail } from '@/utils/utilityFunctions';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: Request) {
  // Require authentication - prevents email spam abuse
  const authResult = await requireApiAuth();
  if (!authResult.authenticated) return authResult.error;

  // Rate limit email sending (stricter limits)
  const rateLimitKey = createRateLimitKey(authResult.userId, 'send-welcome');
  const rateLimitResult = checkRateLimit(
    rateLimitKey,
    RATE_LIMIT_CONFIGS.EMAIL
  );
  if (!rateLimitResult.success) {
    return createRateLimitResponse(rateLimitResult.resetTime);
  }

  const { firstName, email } = await request.json();
  try {
    if (!validateEmail(email)) {
      return Response.json({ error: 'Invalid email address' }, { status: 400 });
    }

    const { data, error } = await resend.emails.send({
      from: 'LodgeFlow <onboarding@resend.dev>',
      to: email,
      subject: 'Welcome to LodgeFlow',
      react: WelcomeEmail({ firstName }),
    });

    if (error) {
      return Response.json({ error }, { status: 500 });
    }

    return Response.json(data);
  } catch (error) {
    return Response.json({ error }, { status: 500 });
  }
}
