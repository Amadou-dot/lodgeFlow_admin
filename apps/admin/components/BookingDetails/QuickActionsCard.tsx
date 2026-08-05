import { useBookingByEmail, useRecordPayment } from '@/hooks/useBookings';
import { useCabin } from '@/hooks/useCabins';
import { usePrintBooking } from '@/hooks/usePrintBooking';
import { useSendConfirmationEmail } from '@/hooks/useSendEmail';
import type { PopulatedBooking } from '@/types';
import { Button } from '@heroui/button';
import { Card, CardBody, CardHeader } from '@heroui/card';
import {
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownTrigger,
} from '@heroui/dropdown';
import { Modal, ModalBody, ModalContent, useDisclosure } from '@heroui/modal';
import { addToast } from '@heroui/toast';
import { useState } from 'react';
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

export default function QuickActionsCard({
  booking,
  onCheckIn,
  onCheckOut,
  actionLoading,
  onPaymentRecorded,
}: QuickActionsCardProps) {
  const { sendConfirmationEmail } = useSendConfirmationEmail();
  const recordPaymentMutation = useRecordPayment();
  const {
    isOpen: isPaymentModalOpen,
    onOpen: onPaymentModalOpen,
    onClose: onPaymentModalClose,
  } = useDisclosure();
  const {
    isOpen: isPrintModalOpen,
    onOpen: onPrintModalOpen,
    onClose: onPrintModalClose,
  } = useDisclosure();
  const [paymentLoading, setPaymentLoading] = useState(false);

  // Get data for email functionality - guard against null customer
  const { data: bookingData, isLoading: bookingLoading } = useBookingByEmail(
    booking.customer?.email ?? ''
  );
  const { data: cabinData, isLoading: cabinLoading } = useCabin(
    extractCabinId(bookingData?.cabin)
  );

  // Initialize print functionality
  const {
    isPrinting,
    isGeneratingPDF,
    handlePrint,
    handleDownloadPDF,
    handleBrowserPrint,
  } = usePrintBooking(booking);

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
      await sendConfirmationEmail(
        firstName,
        booking.customer.email,
        bookingData,
        cabinData
      );
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
    setPaymentLoading(true);
    try {
      await recordPaymentMutation.mutateAsync({
        bookingId: booking._id.toString(),
        ...paymentData,
      });

      addToast({
        color: 'success',
        description: 'Payment recorded successfully',
      });

      // Call the callback to refresh booking data
      onPaymentRecorded?.();
    } catch (error) {
      addToast({
        color: 'danger',
        description: `Failed to record payment: ${(error as Error).message}`,
      });
      throw error; // Re-throw to keep modal open
    } finally {
      setPaymentLoading(false);
    }
  };

  // Print handlers
  const handlePrintBooking = async () => {
    try {
      await handlePrint('booking-pdf-template');
      onPrintModalClose();
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
      onPrintModalClose();
    } catch (error) {
      addToast({
        color: 'danger',
        description: `Failed to generate PDF: ${(error as Error).message}`,
      });
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

          {/* Print Dropdown */}
          <Dropdown>
            <DropdownTrigger>
              <Button
                variant='flat'
                fullWidth
                isDisabled={isPrinting || isGeneratingPDF}
                isLoading={isPrinting || isGeneratingPDF}
              >
                {isPrinting
                  ? 'Printing...'
                  : isGeneratingPDF
                    ? 'Generating PDF...'
                    : 'Print Booking Details'}
              </Button>
            </DropdownTrigger>
            <DropdownMenu>
              <DropdownItem key='print' onPress={onPrintModalOpen}>
                Print Booking
              </DropdownItem>
              <DropdownItem key='pdf' onPress={handleDownloadBookingPDF}>
                Download as PDF
              </DropdownItem>
              <DropdownItem key='browser-print' onPress={handleBrowserPrint}>
                Browser Print
              </DropdownItem>
            </DropdownMenu>
          </Dropdown>
        </CardBody>
      </Card>

      {/* Record Payment Modal */}
      <RecordPaymentModal
        isOpen={isPaymentModalOpen}
        onClose={onPaymentModalClose}
        onRecordPayment={handleRecordPayment}
        totalAmount={booking.totalPrice}
        remainingAmount={booking.remainingAmount}
        bookingId={booking._id.toString()}
        guestName={firstName}
      />

      {/* Print Preview Modal */}
      <Modal
        isOpen={isPrintModalOpen}
        onClose={onPrintModalClose}
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
