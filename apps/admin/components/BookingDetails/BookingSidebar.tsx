import type { PopulatedBooking } from '@/types';
import BookingHistoryCard from './BookingHistoryCard';
import PaymentSummaryCard from './PaymentSummaryCard';
import QuickActionsCard from './QuickActionsCard';

interface BookingSidebarProps {
  booking: PopulatedBooking;
  onCheckIn: () => void;
  onCheckOut: () => void;
  actionLoading: string | null;
  onBookingUpdated?: () => void;
}

export default function BookingSidebar({
  booking,
  onCheckIn,
  onCheckOut,
  actionLoading,
  onBookingUpdated,
}: BookingSidebarProps) {
  return (
    <div className='space-y-6'>
      <PaymentSummaryCard
        numNights={booking.numNights}
        cabinPrice={booking.cabinPrice}
        extrasPrice={booking.extrasPrice}
        totalPrice={booking.totalPrice}
        depositPaid={booking.depositPaid}
        depositAmount={booking.depositAmount}
        amountPaid={booking.amountPaid}
        remainingAmount={booking.remainingAmount}
        paymentMethod={booking.paymentMethod ?? undefined}
        paidAt={booking.paidAt?.toString()}
        stripeSessionId={booking.stripeSessionId ?? undefined}
        stripePaymentIntentId={booking.stripePaymentIntentId ?? undefined}
        paymentConfirmationSentAt={booking.paymentConfirmationSentAt?.toString()}
        refundStatus={booking.refundStatus}
        refundAmount={booking.refundAmount ?? undefined}
        refundedAt={booking.refundedAt?.toString()}
      />

      <QuickActionsCard
        booking={booking}
        onCheckIn={onCheckIn}
        onCheckOut={onCheckOut}
        actionLoading={actionLoading}
        onPaymentRecorded={onBookingUpdated}
      />

      <BookingHistoryCard
        createdAt={booking.createdAt ?? undefined}
        updatedAt={booking.updatedAt ?? undefined}
      />
    </div>
  );
}
