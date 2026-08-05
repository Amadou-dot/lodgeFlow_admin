'use client';

import BookingFormFields from '@/components/BookingFormFields';
import { ArrowLeftIcon } from '@/components/icons';
import { useBookingForm } from '@/hooks/useBookingForm';
import { useBooking, useUpdateBooking } from '@/hooks/useBookings';
import { Button } from '@heroui/button';
import { Card, CardBody } from '@heroui/card';
import { Spinner } from '@heroui/spinner';
import { addToast } from '@heroui/toast';
import { useRouter } from 'next/navigation';
import { use } from 'react';

interface EditBookingPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default function EditBookingPage({ params }: EditBookingPageProps) {
  const router = useRouter();
  const resolvedParams = use(params);
  const { data: booking, isLoading, error } = useBooking(resolvedParams.id);
  const updateBooking = useUpdateBooking();

  // Use the booking form hook with initial booking data
  const bookingFormHook = useBookingForm(booking);
  const { validateForm, buildBookingData } = bookingFormHook;

  const handleSuccess = () => {
    // Navigate back to booking details with success message
    router.push(`/bookings/${resolvedParams.id}?updated=true`);
  };

  const handleCancel = () => {
    router.back();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const errors = validateForm();
    if (errors.length > 0) {
      addToast({
        title: 'Validation errors',
        description: errors.join('\n'),
        color: 'danger',
      });
      return;
    }

    try {
      const bookingData = {
        ...buildBookingData(),
        _id: booking!._id.toString(),
        status: booking!.status, // Preserve existing status
      };

      await updateBooking.mutateAsync(bookingData);
      handleSuccess();
    } catch (error) {
      // Toast is shown by the mutation's onError callback
      console.error('Error updating booking:', error);
    }
  };

  if (isLoading) {
    return (
      <div className='flex justify-center items-center min-h-[400px]'>
        <Spinner size='lg' />
      </div>
    );
  }

  if (error || !booking) {
    return (
      <div className='container mx-auto px-4 py-8 max-w-7xl'>
        <div className='text-center'>
          <h1 className='text-2xl font-bold text-danger mb-4'>Error</h1>
          <p className='text-default-600 mb-4'>
            {error ? 'Failed to load booking data.' : 'Booking not found.'}
          </p>
          <Button color='primary' onPress={() => router.back()}>
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className='container mx-auto px-4 py-8 max-w-7xl'>
      {/* Header */}
      <div className='flex items-center gap-4 mb-8'>
        <Button
          isIconOnly
          variant='light'
          onPress={() => router.back()}
          aria-label='Go back'
        >
          <ArrowLeftIcon />
        </Button>
        <div>
          <h1 className='text-3xl font-bold'>Edit Booking</h1>
          <p className='text-default-600 mt-1'>
            Update booking details for{' '}
            {typeof booking.customer === 'string'
              ? booking.customer
              : booking.customer.name}
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div className='grid grid-cols-1 lg:grid-cols-4 gap-8'>
        {/* Form Section - Takes up 3/4 of the space */}
        <div className='lg:col-span-3'>
          <Card className='shadow-lg'>
            <CardBody className='p-8'>
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
                  setSpecialRequestInput={
                    bookingFormHook.setSpecialRequestInput
                  }
                  formatCurrency={bookingFormHook.formatCurrency}
                  showPayment={true}
                  showPricing={true}
                  excludeBookingId={booking._id.toString()}
                />

                {/* Form Actions */}
                <div className='flex justify-end gap-4 pt-6 border-t'>
                  <Button
                    variant='light'
                    onPress={handleCancel}
                    isDisabled={updateBooking.isPending}
                    type='button'
                  >
                    Cancel
                  </Button>
                  <Button
                    color='primary'
                    type='submit'
                    isLoading={updateBooking.isPending}
                  >
                    {updateBooking.isPending ? 'Updating...' : 'Update Booking'}
                  </Button>
                </div>
              </form>
            </CardBody>
          </Card>
        </div>

        {/* Sidebar - Takes up 1/4 of the space */}
        <div className='lg:col-span-1'>
          <div className='sticky top-8 space-y-6'>
            {/* Booking Tips */}
            <Card>
              <CardBody className='space-y-4'>
                <div>
                  <h4 className='font-medium text-sm mb-2'>✏️ Edit Booking</h4>
                  <p className='text-sm text-default-600'>
                    Make necessary changes to the booking details. All fields
                    are pre-filled with current values.
                  </p>
                </div>
                <div>
                  <h4 className='font-medium text-sm mb-2'>📅 Date Changes</h4>
                  <p className='text-sm text-default-600'>
                    When changing dates, ensure the new dates don't conflict
                    with other bookings for the same cabin.
                  </p>
                </div>
                <div>
                  <h4 className='font-medium text-sm mb-2'>💰 Pricing</h4>
                  <p className='text-sm text-default-600'>
                    Total price will be recalculated automatically based on any
                    changes to dates, cabin, or extras.
                  </p>
                </div>
                <div>
                  <h4 className='font-medium text-sm mb-2'>🔒 Status</h4>
                  <p className='text-sm text-default-600'>
                    The booking status will be preserved. Use the booking
                    details page to change status if needed.
                  </p>
                </div>
              </CardBody>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
