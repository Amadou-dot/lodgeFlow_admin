import { getEmailSender } from '@lodgeflow/email';
import { logger } from '@lodgeflow/database/logger';
import { getResend } from '@/lib/resend';

import { WelcomeEmail } from '@/components/EmailTemplates';
import { auth, currentUser } from '@clerk/nextjs/server';

function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export async function POST() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return Response.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const user = await currentUser();
    const email = user?.emailAddresses?.[0]?.emailAddress;
    const firstName = user?.firstName || 'Guest';

    if (!email || !validateEmail(email)) {
      return Response.json({ error: 'Invalid email address' }, { status: 400 });
    }

    const { data, error } = await getResend().emails.send({
      from: getEmailSender({ kind: 'notification' }),
      react: WelcomeEmail({ firstName }),
      subject: 'Welcome to LodgeFlow',
      to: email,
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
