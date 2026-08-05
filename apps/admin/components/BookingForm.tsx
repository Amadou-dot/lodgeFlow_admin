'use client';

import { useBookingForm } from '@/hooks/useBookingForm';
import { useCreateBooking } from '@/hooks/useBookings';
import { useEffect } from 'react';
import { FormActions } from './BookingForm/index';
import BookingFormFields from './BookingFormFields';

interface BookingPrefillData {
  customer?: string;
}

interface BookingFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
  prefillData?: BookingPrefillData;
}

export default function BookingForm({
  onSuccess,
  onCancel,
  prefillData,
}: BookingFormProps) {
  const createBooking = useCreateBooking();

  // Use the booking form hook here and pass everything to BookingFormFields
  const bookingFormHook = useBookingForm();
  const { validateForm, buildBookingData, handleInputChange } = bookingFormHook;

  // Handle prefill data when component mounts or prefillData changes
  useEffect(() => {
    if (prefillData?.customer) {
      handleInputChange('customer', prefillData.customer);
    }
  }, [prefillData, handleInputChange]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const errors = validateForm();
    if (errors.length > 0) {
      alert(errors.join('\n'));
      return;
    }

    try {
      const bookingData = buildBookingData();
      await createBooking.mutateAsync(bookingData);
      onSuccess?.();
    } catch (error) {
      console.error('Error creating booking:', error);
      const message =
        error instanceof Error
          ? error.message
          : 'Failed to create booking. Please try again.';
      alert(message);
    }
  };

  return (
    <form onSubmit={handleSubmit} className='space-y-6'>
      <BookingFormFields
        formData={bookingFormHook.formData}
        specialRequestInput={bookingFormHook.specialRequestInput}
        priceBreakdown={bookingFormHook.priceBreakdown}
        selectedCabin={bookingFormHook.selectedCabin}
        numNights={bookingFormHook.numNights}
        cabins={bookingFormHook.cabins}
        customers={bookingFormHook.customers}
        customersLoading={bookingFormHook.customersLoading}
        settings={bookingFormHook.settings}
        scrollerRef={bookingFormHook.scrollerRef}
        isCustomerOpen={bookingFormHook.isCustomerOpen}
        setIsCustomerOpen={bookingFormHook.setIsCustomerOpen}
        handleInputChange={bookingFormHook.handleInputChange}
        handleCustomerSearch={bookingFormHook.handleCustomerSearch}
        addSpecialRequest={bookingFormHook.addSpecialRequest}
        removeSpecialRequest={bookingFormHook.removeSpecialRequest}
        setSpecialRequestInput={bookingFormHook.setSpecialRequestInput}
        formatCurrency={bookingFormHook.formatCurrency}
        showPayment={true}
        showPricing={true}
      />

      {/* Form Actions */}
      <FormActions onCancel={onCancel} isLoading={createBooking.isPending} />
    </form>
  );
}
