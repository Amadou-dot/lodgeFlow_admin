import {
  confirmationEmailSchema,
  type ConfirmationEmailRequest,
} from '@/lib/validations/confirmation-email';
import { useCallback } from 'react';
import { readSendEmailResponse } from '@/lib/validations/send-email-response';
import type { WelcomeEmailInput } from '@/lib/validations/welcome-email';

export function useSendConfirmationEmail() {
  const sendConfirmationEmail = useCallback(
    async (input: ConfirmationEmailRequest) => {
      const payload = confirmationEmailSchema.parse(input);
      const response = await fetch('/api/send/confirm', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      return readSendEmailResponse({ response, kind: 'confirmation' });
    },
    []
  );

  return { sendConfirmationEmail };
}

export function useSendWelcomeEmail() {
  const sendWelcomeEmail = useCallback(
    async ({ firstName, email }: WelcomeEmailInput): Promise<unknown> => {
      const response = await fetch('/api/send/welcome', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ firstName, email }),
      });

      return readSendEmailResponse({ response, kind: 'welcome' });
    },
    []
  );

  return { sendWelcomeEmail };
}
