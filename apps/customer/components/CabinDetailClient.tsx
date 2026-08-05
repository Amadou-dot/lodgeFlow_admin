'use client';

import { Button } from '@heroui/button';
import { Tooltip } from '@heroui/tooltip';
import { useUser } from '@clerk/nextjs';
import { ArrowLeft, Heart } from 'lucide-react';
import { useRouter } from 'next/navigation';

import BookingForm from '@/components/BookingForm';
import Breadcrumb from '@/components/Breadcrumb';
import CabinAvailabilityPreview from '@/components/CabinAvailabilityPreview';
import CabinBookingSteps from '@/components/CabinBookingSteps';
import CabinDetails from '@/components/CabinDetails';
import CabinGallery from '@/components/CabinGallery';
import CabinMobileTabs from '@/components/CabinMobileTabs';
import CabinPricingCalculator from '@/components/CabinPricingCalculator';
import CabinShareButton from '@/components/CabinShareButton';
import CabinSimilar from '@/components/CabinSimilar';
import CabinTestimonials from '@/components/CabinTestimonials';
import CabinTrustIndicators from '@/components/CabinTrustIndicators';
import { useSettings } from '@/hooks/useSettings';
import type { Cabin } from '@/types';

interface CabinDetailClientProps {
  cabin: Cabin;
}

export default function CabinDetailClient({ cabin }: CabinDetailClientProps) {
  const { data: settings, isError: settingsError } = useSettings();
  const { user } = useUser();
  const router = useRouter();

  const cabinId = (cabin as any)._id?.toString?.() ?? (cabin as any)._id;

  const userData = user
    ? {
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        email: user.emailAddresses[0]?.emailAddress || '',
        phone: user.phoneNumbers[0]?.phoneNumber || '',
      }
    : undefined;

  const breadcrumbItems = [
    { label: 'Home', href: '/' },
    { label: 'Cabins', href: '/cabins' },
    { label: cabin.name },
  ];

  const bookingCabin = {
    _id: cabinId,
    discount: cabin.discount,
    image: cabin.image,
    maxCapacity: cabin.capacity,
    name: cabin.name,
    regularPrice: cabin.price,
  };

  return (
    <div className='container mx-auto px-4 py-8 max-w-7xl'>
      {/* Breadcrumb Navigation */}
      <div className='mb-6'>
        <Breadcrumb items={breadcrumbItems} />
      </div>

      {/* Back Button */}
      <div className='mb-8'>
        <Button
          className='gap-2'
          startContent={<ArrowLeft size={18} />}
          variant='light'
          onPress={() => router.push('/cabins')}
        >
          Back to Cabins
        </Button>
      </div>

      {/* Main Content */}
      <div className='space-y-8'>
        <CabinGallery
          images={[cabin.image, ...(cabin.images || [])].filter(Boolean)}
        />

        <div className='flex gap-2'>
          <CabinShareButton cabinName={cabin.name} />
          <Tooltip content='Coming soon'>
            <Button
              aria-label='Add to wishlist (coming soon)'
              isDisabled
              variant='light'
            >
              <Heart size={18} />
            </Button>
          </Tooltip>
        </div>

        {/* Mobile Layout: tabbed interface (< lg) */}
        <div className='lg:hidden' id='booking'>
          <CabinMobileTabs
            bookingCabin={bookingCabin}
            cabin={cabin}
            userData={userData}
          />
        </div>

        {/* Desktop Layout: vertical stack (lg+) */}
        <div className='hidden lg:block space-y-8'>
          {settings?.cancellationPolicy ? (
            <CabinTrustIndicators
              cancellationPolicy={
                settings.cancellationPolicy as
                  'flexible' | 'moderate' | 'strict'
              }
            />
          ) : settingsError ? (
            <p className='text-sm text-foreground-400'>
              Trust information temporarily unavailable.
            </p>
          ) : null}

          <CabinDetails cabin={cabin} />

          <CabinTestimonials />

          <CabinAvailabilityPreview cabinId={cabinId} />

          <CabinBookingSteps />

          <div className='lg:max-w-3xl lg:mx-auto' id='booking'>
            <BookingForm cabin={bookingCabin} userData={userData} />
          </div>
        </div>
      </div>

      {/* Price Calculator - mobile only */}
      <div className='mt-8 lg:hidden'>
        <CabinPricingCalculator discount={cabin.discount} price={cabin.price} />
      </div>

      {/* Similar Cabins */}
      <div className='mt-8'>
        <CabinSimilar capacity={cabin.capacity} currentCabinId={cabinId} />
      </div>
    </div>
  );
}
