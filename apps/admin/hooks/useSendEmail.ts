import { Cabin, PopulatedBooking } from '@/types';
import { useCallback } from 'react';

export function useSendConfirmationEmail() {
  const sendConfirmationEmail = useCallback(
    async (
      firstName: string,
      email: string,
      bookingData: PopulatedBooking,
      cabinData: Cabin
    ) => {
      const response = await fetch('/api/send/confirm', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ firstName, email, bookingData, cabinData }),
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
    async (firstName: string, email: string) => {
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
