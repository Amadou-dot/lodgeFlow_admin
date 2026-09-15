'use client';

import BookingForm from '@/components/BookingForm';
import {
  CabinAmenitiesSection,
  CabinDescriptionSection,
  CabinHouseRulesSection,
  CabinInfoSection,
} from '@/components/CabinDetails';
import type { Cabin } from '@/types';
import { Tab, Tabs } from '@heroui/tabs';

interface BookingCabin {
  _id: string;
  name: string;
  regularPrice: number;
  discount?: number;
  maxCapacity: number;
  image?: string;
}

interface CabinMobileTabsProps {
  bookingCabin: BookingCabin;
  cabin: Cabin;
  userData?: {
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
  };
}

export default function CabinMobileTabs({
  bookingCabin,
  cabin,
  userData,
}: CabinMobileTabsProps) {
  return (
    <Tabs
      aria-label='Cabin information tabs'
      className='w-full'
      color='primary'
      fullWidth
      size='lg'
      variant='underlined'
    >
      <Tab key='details' title='Details'>
        <div className='space-y-6 pt-2'>
          <CabinDescriptionSection cabin={cabin} />
          <CabinInfoSection cabin={cabin} />
          <CabinHouseRulesSection />
        </div>
      </Tab>
      <Tab key='amenities' title='Amenities'>
        <div className='pt-2'>
          <CabinAmenitiesSection cabin={cabin} />
        </div>
      </Tab>
      <Tab key='book' title='Book'>
        <div className='pt-2'>
          <BookingForm cabin={bookingCabin} userData={userData} />
        </div>
      </Tab>
    </Tabs>
  );
}
