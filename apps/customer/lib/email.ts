import { getResend } from '@/lib/resend';
import { clerkClient } from '@clerk/nextjs/server';

import { PaymentConfirmationEmail } from '@/components/EmailTemplates';
import type { PopulatedBooking, Cabin } from '@/types';

function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export interface SendPaymentConfirmationParams {
  booking: PopulatedBooking;
  cabin: Cabin;
  amountPaid: number;
  isDeposit: boolean;
}

export interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export async function sendPaymentConfirmationEmail(
  params: SendPaymentConfirmationParams
): Promise<EmailResult> {
  const { booking, cabin, amountPaid, isDeposit } = params;

  try {
    // Get user info from Clerk
    const clerk = await clerkClient();
    const user = await clerk.users.getUser(booking.customer as string);

    const email = user.emailAddresses?.[0]?.emailAddress;
    const firstName = user.firstName || 'Guest';

    if (!email || !validateEmail(email)) {
      return {
        success: false,
        error: 'Invalid or missing email address for customer',
      };
    }

    const { data, error } = await getResend().emails.send({
      from: 'LodgeFlow <onboarding@resend.dev>',
      to: email,
      subject: `Payment Confirmation - ${cabin.name}`,
      react: PaymentConfirmationEmail({
        bookingData: booking,
        cabinData: cabin,
        firstName,
        amountPaid,
        isDeposit,
      }),
    });

    if (error) {
      console.error('Resend email error:', error);
      return {
        success: false,
        error: error.message,
      };
    }

    return {
      success: true,
      messageId: data?.id,
    };
  } catch (error) {
    console.error('Failed to send payment confirmation email:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to send email',
    };
  }
}

export interface SendCancellationConfirmationParams {
  booking: PopulatedBooking;
  cabin: Cabin;
  refundAmount: number;
  refundType: 'full' | 'partial' | 'none';
  reason: string;
}

export async function sendCancellationConfirmationEmail(
  params: SendCancellationConfirmationParams
): Promise<EmailResult> {
  const { booking, cabin, refundAmount, refundType, reason } = params;

  try {
    const clerk = await clerkClient();
    const user = await clerk.users.getUser(booking.customer as string);

    const email = user.emailAddresses?.[0]?.emailAddress;
    const firstName = user.firstName || 'Guest';

    if (!email || !validateEmail(email)) {
      return {
        success: false,
        error: 'Invalid or missing email address for customer',
      };
    }

    const refundMessage =
      refundType === 'none'
        ? 'No refund is applicable based on our cancellation policy.'
        : `You will receive a ${refundType} refund of $${refundAmount.toFixed(2)}.`;

    const { data, error } = await getResend().emails.send({
      from: 'LodgeFlow <onboarding@resend.dev>',
      to: email,
      subject: `Booking Cancellation Confirmed - ${cabin.name}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Booking Cancellation</title>
        </head>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
          <div style="background-color: #2563eb; padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0;">Booking Cancelled</h1>
          </div>
          <div style="background-color: #f8fafc; padding: 30px 20px;">
            <p>Hi ${firstName},</p>
            <p>Your booking at <strong>${cabin.name}</strong> has been cancelled.</p>

            <div style="background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #e2e8f0;">
              <h3 style="margin-top: 0; color: #1e293b;">Cancellation Details</h3>
              <p><strong>Property:</strong> ${cabin.name}</p>
              <p><strong>Check-in:</strong> ${new Date(booking.checkInDate).toLocaleDateString()}</p>
              <p><strong>Check-out:</strong> ${new Date(booking.checkOutDate).toLocaleDateString()}</p>
              <p><strong>Original Total:</strong> $${booking.totalPrice.toFixed(2)}</p>
            </div>

            <div style="background-color: ${refundType === 'none' ? '#fef3c7' : '#dcfce7'}; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <h4 style="margin-top: 0; color: ${refundType === 'none' ? '#92400e' : '#166534'};">Refund Information</h4>
              <p style="margin-bottom: 0;">${refundMessage}</p>
              <p style="font-size: 0.9em; color: #64748b; margin-top: 10px;">${reason}</p>
            </div>

            <p>If you have any questions about your cancellation or refund, please don't hesitate to contact us.</p>
          </div>
          <div style="background-color: #1e293b; padding: 20px; border-radius: 0 0 8px 8px; text-align: center; color: white;">
            <p style="margin: 0; font-size: 0.9em;">Thank you for considering LodgeFlow</p>
          </div>
        </body>
        </html>
      `,
    });

    if (error) {
      console.error('Resend email error:', error);
      return {
        success: false,
        error: error.message,
      };
    }

    return {
      success: true,
      messageId: data?.id,
    };
  } catch (error) {
    console.error('Failed to send cancellation confirmation email:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to send email',
    };
  }
}
