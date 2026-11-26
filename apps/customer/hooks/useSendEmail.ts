import { useCallback } from 'react';
import { readSendEmailResponse } from '@/lib/validations/send-email-response';
import type { BookingConfirmationInput } from '@/lib/validations/confirmation-email';

/**
 * Hook to send booking confirmation email
 */
export function useSendConfirmationEmail() {
  const sendConfirmationEmail = useCallback(async (bookingId: string) => {
    const response = await fetch('/api/send/confirm', {
      body: JSON.stringify({ bookingId } satisfies BookingConfirmationInput),
      headers: {
        'Content-Type': 'application/json',
      },
      method: 'POST',
    });

    return readSendEmailResponse({ response, kind: 'confirmation' });
  }, []);

  return { sendConfirmationEmail };
}

/**
 * Hook to send welcome email
 */
export function useSendWelcomeEmail() {
  const sendWelcomeEmail = useCallback(async () => {
    const response = await fetch('/api/send/welcome', {
      headers: {
        'Content-Type': 'application/json',
      },
      method: 'POST',
    });

    return readSendEmailResponse({ response, kind: 'welcome' });
  }, []);

  return { sendWelcomeEmail };
}
