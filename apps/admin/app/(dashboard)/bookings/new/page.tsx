'use client';

import BookingForm from '@/components/BookingForm';
import { ArrowLeftIcon } from '@/components/icons';
import { Button } from '@heroui/button';
import { Card, CardBody, CardHeader } from '@heroui/card';
import { Spinner } from '@heroui/spinner';
import { useRouter, useSearchParams } from 'next/navigation';

import { Suspense, useEffect, useState } from 'react';

interface BookingPrefillData {
  customer: string;
  customerSearchTerm: string;
}

function NewBookingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [prefillData, setPrefillData] = useState<
    BookingPrefillData | undefined
  >(undefined);

  // Extract prefill data from URL parameters
  useEffect(() => {
    const customerId = searchParams.get('customer');
    const guestName = searchParams.get('guestName');

    if (customerId || guestName) {
      setPrefillData({
        customer: customerId || '',
        // If we have a guest name but no customer ID, we could pre-populate the search
        customerSearchTerm: guestName || '',
      });
    }
  }, [searchParams]);

  const handleSuccess = () => {
    // Navigate back to bookings list with success message
    router.push('/bookings?created=true');
  };

  const handleCancel = () => {
    router.back();
  };

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
          <h1 className='text-3xl font-bold'>Create New Booking</h1>
          <p className='text-default-600 mt-1'>
            {prefillData?.customerSearchTerm
              ? `Creating booking for ${prefillData.customerSearchTerm}`
              : 'Fill in the details below to create a new cabin reservation'}
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div className='grid grid-cols-1 lg:grid-cols-4 gap-8'>
        {/* Form Section - Takes up 3/4 of the space */}
        <div className='lg:col-span-3'>
          <Card className='shadow-lg'>
            <CardBody className='p-8'>
              <BookingForm
                onSuccess={handleSuccess}
                onCancel={handleCancel}
                prefillData={prefillData}
              />
            </CardBody>
          </Card>
        </div>

        {/* Sidebar - Takes up 1/4 of the space */}
        <div className='lg:col-span-1'>
          <div className='sticky top-8 space-y-6'>
            {/* Booking Tips */}
            <Card>
              <CardHeader>
                <h3 className='text-lg font-semibold'>Booking Tips</h3>
              </CardHeader>
              <CardBody className='space-y-4'>
                <div>
                  <h4 className='font-medium text-sm mb-2'>
                    🏠 Cabin Selection
                  </h4>
                  <p className='text-sm text-default-600'>
                    Choose the cabin based on guest count and preferences. Check
                    availability for the selected dates.
                  </p>
                </div>
                <div>
                  <h4 className='font-medium text-sm mb-2'>📅 Dates</h4>
                  <p className='text-sm text-default-600'>
                    Ensure check-in is not on the same day as another guest's
                    check-out from the same cabin.
                  </p>
                </div>
                <div>
                  <h4 className='font-medium text-sm mb-2'>💰 Pricing</h4>
                  <p className='text-sm text-default-600'>
                    Total price is calculated automatically based on cabin rate,
                    duration, and selected extras.
                  </p>
                </div>
                <div>
                  <h4 className='font-medium text-sm mb-2'>✅ Confirmation</h4>
                  <p className='text-sm text-default-600'>
                    Review all details before confirming. Guest will receive
                    confirmation email automatically.
                  </p>
                </div>
              </CardBody>
            </Card>

            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <h3 className='text-lg font-semibold'>Quick Actions</h3>
              </CardHeader>
              <CardBody className='space-y-3'>
                <Button
                  variant='bordered'
                  className='w-full justify-start'
                  onPress={() => router.push('/guests/new')}
                >
                  + Add New Guest
                </Button>
                <Button
                  variant='bordered'
                  className='w-full justify-start'
                  onPress={() => router.push('/cabins')}
                >
                  📊 View Cabin Availability
                </Button>
                <Button
                  variant='bordered'
                  className='w-full justify-start'
                  onPress={() => router.push('/bookings')}
                >
                  📋 View All Bookings
                </Button>
              </CardBody>
            </Card>

            {/* Recent Activity */}
            <Card>
              <CardHeader>
                <h3 className='text-lg font-semibold'>Need Help?</h3>
              </CardHeader>
              <CardBody className='space-y-3'>
                <p className='text-sm text-default-600'>
                  If you encounter any issues while creating the booking, you
                  can:
                </p>
                <ul className='text-sm text-default-600 space-y-1'>
                  <li>• Check cabin availability calendar</li>
                  <li>• Verify guest information</li>
                  <li>• Review pricing settings</li>
                  <li>• Contact support if needed</li>
                </ul>
              </CardBody>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function NewBookingPage() {
  return (
    <Suspense fallback={<Spinner title='Loading new booking...' />}>
      <NewBookingContent />
    </Suspense>
  );
}
