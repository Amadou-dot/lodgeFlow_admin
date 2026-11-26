import { useBookingByEmail, useRecordPayment } from '@/hooks/useBookings';
import { useCabin } from '@/hooks/useCabins';
import { usePrintBooking } from '@/hooks/usePrintBooking';
import { useSendConfirmationEmail } from '@/hooks/useSendEmail';
import type { PopulatedBooking } from '@/types';
import { Button } from '@heroui/button';
import { Card, CardBody, CardHeader } from '@heroui/card';
import { Modal, ModalBody, ModalContent } from '@heroui/modal';
import { addToast } from '@heroui/toast';
import { useAuth } from '@clerk/nextjs';
import { useLayoutEffect, useRef, useState } from 'react';
import RecordPaymentModal, { PaymentData } from '../RecordPaymentModal';
import BookingPDFTemplate from './BookingPDFTemplate';

interface QuickActionsCardProps {
  booking: PopulatedBooking;
  onCheckIn: () => void;
  onCheckOut: () => void;
  actionLoading: string | null;
  onPaymentRecorded?: () => void;
}

/**
 * Extracts the cabin ID from a booking's cabin field.
 * Handles both populated cabin objects and unpopulated ObjectId references.
 */
function extractCabinId(
  cabin: { _id?: string | object } | string | null | undefined
): string {
  if (!cabin) return '';
  if (typeof cabin === 'object' && cabin._id !== undefined) {
    return String(cabin._id);
  }
  return String(cabin);
}

export default function QuickActionsCard(props: QuickActionsCardProps) {
  const { userId, sessionId } = useAuth();
  return (
    <QuickActionsContent
      key={JSON.stringify([props.booking._id, userId, sessionId])}
      {...props}
    />
  );
}
function QuickActionsContent({
  booking,
  onCheckIn,
  onCheckOut,
  actionLoading,
  onPaymentRecorded,
}: QuickActionsCardProps) {
  const { sendConfirmationEmail } = useSendConfirmationEmail();
  const [dialog, setDialog] = useState<
    { kind: 'closed' | 'print' } | { kind: 'payment'; id: symbol }
  >({ kind: 'closed' });
  const active = useRef(true);
  useLayoutEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  const closeDialog = () =>
    setDialog(current => (current === dialog ? { kind: 'closed' } : current));
  const recordPaymentMutation = useRecordPayment({
    booking,
    dialogId: dialog.kind === 'payment' ? dialog.id : null,
    onReconciled: () => {
      closeDialog();
      addToast({
        color: 'success',
        description: 'Previously submitted payment confirmed',
      });
    },
  });
  const onPaymentModalOpen = () =>
    setDialog({ kind: 'payment', id: Symbol('payment dialog') });
  const onPrintModalOpen = () => setDialog({ kind: 'print' });
  const paymentLoading = recordPaymentMutation.isPending;

  // Get data for email functionality - guard against null customer
  const { data: bookingData, isLoading: bookingLoading } = useBookingByEmail(
    booking.customer?.email ?? ''
  );
  const { data: cabinData, isLoading: cabinLoading } = useCabin(
    extractCabinId(bookingData?.cabin)
  );

  // Initialize print functionality
  const { isPrinting, isGeneratingPDF, handlePrint, handleDownloadPDF } =
    usePrintBooking(booking);

  const handleSendConfirmation = async () => {
    if (!bookingData || !cabinData || !booking.customer) {
      addToast({
        color: 'danger',
        description: 'Booking, cabin, or customer data not available',
      });
      return;
    }

    try {
      const firstName =
        booking.customer.first_name || booking.customer.name || 'Guest';
      await sendConfirmationEmail({
        firstName,
        email: booking.customer.email,
        bookingData,
        cabinData,
      });
      addToast({
        color: 'success',
        description: 'Confirmation email sent successfully',
      });
    } catch (error) {
      addToast({
        color: 'danger',
        description: `Email Failed to send: ${(error as Error).message}`,
      });
    }
  };

  const handleRecordPayment = async (paymentData: PaymentData) => {
    try {
      await recordPaymentMutation.mutateAsync({
        bookingId: booking._id.toString(),
        ...paymentData,
      });

      if (!active.current) return;
      addToast({
        color: 'success',
        description: 'Payment recorded successfully',
      });

      // Call the callback to refresh booking data
      onPaymentRecorded?.();
    } catch (error) {
      if (!active.current) throw error;
      addToast({
        color: 'danger',
        description: `Failed to record payment: ${(error as Error).message}`,
      });
      throw error; // Re-throw to keep modal open
    }
  };

  const handleRetryPreviousPayment = async () => {
    try {
      await recordPaymentMutation.retryPreviousPayment();
      if (!active.current) return;
      addToast({
        color: 'success',
        description: 'Previously submitted payment confirmed',
      });
    } catch (error) {
      if (!active.current) return;
      addToast({
        color: 'danger',
        description:
          error instanceof Error
            ? error.message
            : 'Failed to confirm the previous payment',
      });
    }
  };

  // Print handlers
  const handlePrintBooking = async () => {
    try {
      await handlePrint('booking-pdf-template');
      closeDialog();
    } catch (error) {
      addToast({
        color: 'danger',
        description: `Failed to print booking: ${(error as Error).message}`,
      });
    }
  };

  const handleDownloadBookingPDF = async () => {
    try {
      await handleDownloadPDF('booking-pdf-template');
      closeDialog();
    } catch {
      // The print hook reports PDF failure; keep this dialog open for retry.
    }
  };

  const isDataLoading = bookingLoading || cabinLoading;
  const firstName =
    booking.customer?.first_name || booking.customer?.name || 'Guest';
  const isPaymentButtonVisible =
    !booking.isPaid && booking.status !== 'cancelled';

  return (
    <>
      <Card>
        <CardHeader>
          <h2 className='text-lg font-semibold'>Quick Actions</h2>
        </CardHeader>
        <CardBody className='space-y-2'>
          {booking.status === 'confirmed' && (
            <Button
              color='success'
              variant='flat'
              fullWidth
              onPress={onCheckIn}
              isLoading={actionLoading === 'check-in'}
              isDisabled={actionLoading !== null}
            >
              Check In Guest
            </Button>
          )}
          {booking.status === 'checked-in' && (
            <Button
              color='primary'
              variant='flat'
              fullWidth
              onPress={onCheckOut}
              isLoading={actionLoading === 'check-out'}
              isDisabled={actionLoading !== null}
            >
              Check Out Guest
            </Button>
          )}
          {isPaymentButtonVisible && (
            <Button
              color='warning'
              variant='flat'
              fullWidth
              onPress={onPaymentModalOpen}
              isDisabled={actionLoading !== null || paymentLoading}
            >
              Record Payment
            </Button>
          )}
          <Button
            variant='flat'
            fullWidth
            onPress={handleSendConfirmation}
            isDisabled={isDataLoading}
          >
            Send Confirmation Email
          </Button>

          <Button
            variant='flat'
            fullWidth
            onPress={onPrintModalOpen}
            isDisabled={isPrinting || isGeneratingPDF}
            isLoading={isPrinting || isGeneratingPDF}
          >
            {isPrinting
              ? 'Printing...'
              : isGeneratingPDF
                ? 'Generating PDF...'
                : 'Print / Download'}
          </Button>
        </CardBody>
      </Card>

      {/* Record Payment Modal */}
      {dialog.kind === 'payment' && (
        <RecordPaymentModal
          isLoading={paymentLoading}
          isOpen
          onClose={closeDialog}
          onRecordPayment={handleRecordPayment}
          previousPayment={
            recordPaymentMutation.previousPayment && {
              ...recordPaymentMutation.previousPayment,
              onRetry: handleRetryPreviousPayment,
            }
          }
          totalAmount={booking.totalPrice}
          remainingAmount={booking.remainingAmount ?? null}
          bookingId={booking._id.toString()}
          guestName={firstName}
        />
      )}

      {/* Print Preview Modal */}
      <Modal
        isOpen={dialog.kind === 'print'}
        onClose={closeDialog}
        size='5xl'
        scrollBehavior='inside'
      >
        <ModalContent>
          <ModalBody className='p-0'>
            <div className='p-4 border-b border-default-200 flex justify-between items-center'>
              <h3 className='text-lg font-semibold'>Print Preview</h3>
              <div className='flex gap-2'>
                <Button
                  size='sm'
                  variant='flat'
                  onPress={handlePrintBooking}
                  isLoading={isPrinting}
                  isDisabled={isGeneratingPDF}
                >
                  Print
                </Button>
                <Button
                  size='sm'
                  color='primary'
                  onPress={handleDownloadBookingPDF}
                  isLoading={isGeneratingPDF}
                  isDisabled={isPrinting}
                >
                  Download PDF
                </Button>
              </div>
            </div>
            <div className='p-4'>
              <BookingPDFTemplate booking={booking} className='max-w-none' />
            </div>
          </ModalBody>
        </ModalContent>
      </Modal>
    </>
  );
}
