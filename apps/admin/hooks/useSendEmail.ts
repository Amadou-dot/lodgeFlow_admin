import {
  confirmationEmailSchema,
  type ConfirmationEmailRequest,
} from '@/lib/validations/confirmation-email';
import { useCallback } from 'react';
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

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to send confirmation email');
      }

      return response.json();
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

      if (!response.ok) {
        throw new Error('Failed to send welcome email');
      }

      return response.json();
    },
    []
  );

  return { sendWelcomeEmail };
}
