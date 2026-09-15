import { useCallback } from 'react';

/**
 * Hook to send booking confirmation email
 */
export function useSendConfirmationEmail() {
  const sendConfirmationEmail = useCallback(async (bookingId: string) => {
    const response = await fetch('/api/send/confirm', {
      body: JSON.stringify({ bookingId }),
      headers: {
        'Content-Type': 'application/json',
      },
      method: 'POST',
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Failed to send confirmation email');
    }

    return response.json();
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

    if (!response.ok) {
      throw new Error('Failed to send welcome email');
    }

    return response.json();
  }, []);

  return { sendWelcomeEmail };
}
