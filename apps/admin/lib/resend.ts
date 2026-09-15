import { Resend } from 'resend';

// Singleton Resend instance.
//
// Constructed lazily rather than at module scope: Resend throws when the API
// key is missing, and Next evaluates these modules while collecting page data
// during `next build`. Building would otherwise require a real (or fake)
// RESEND_API_KEY. Mirrors getStripe() in lib/stripe.ts.
let resendInstance: Resend | null = null;

export function getResend(): Resend {
  if (!resendInstance) {
    if (!process.env.RESEND_API_KEY) {
      throw new Error('RESEND_API_KEY environment variable is not set');
    }
    resendInstance = new Resend(process.env.RESEND_API_KEY);
  }
  return resendInstance;
}
