import { Card, CardBody, CardHeader } from '@heroui/card';

import type { AdminBooking } from '@/types/booking-read';
interface ExtrasCardProps {
  extras?: NonNullable<AdminBooking['extras']>;
}
function fee(amount: number | null | undefined) {
  return amount == null ? 'Unavailable' : `$${amount}`;
}

export default function ExtrasCard({ extras }: ExtrasCardProps) {
  if (!extras) return null;
  const hasAnyExtras =
    extras.hasBreakfast ||
    extras.hasPets ||
    extras.hasParking ||
    extras.hasEarlyCheckIn ||
    extras.hasLateCheckOut;

  if (!hasAnyExtras) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <h2 className='text-lg font-semibold'>Extras & Add-ons</h2>
      </CardHeader>
      <CardBody>
        <div className='space-y-2'>
          {extras.hasBreakfast && (
            <div className='flex justify-between items-center'>
              <span>Breakfast</span>
              <span className='font-medium'>{fee(extras.breakfastPrice)}</span>
            </div>
          )}
          {extras.hasPets && (
            <div className='flex justify-between items-center'>
              <span>Pet Fee</span>
              <span className='font-medium'>{fee(extras.petFee)}</span>
            </div>
          )}
          {extras.hasParking && (
            <div className='flex justify-between items-center'>
              <span>Parking</span>
              <span className='font-medium'>{fee(extras.parkingFee)}</span>
            </div>
          )}
          {extras.hasEarlyCheckIn && (
            <div className='flex justify-between items-center'>
              <span>Early Check-in</span>
              <span className='font-medium'>{fee(extras.earlyCheckInFee)}</span>
            </div>
          )}
          {extras.hasLateCheckOut && (
            <div className='flex justify-between items-center'>
              <span>Late Check-out</span>
              <span className='font-medium'>{fee(extras.lateCheckOutFee)}</span>
            </div>
          )}
        </div>
      </CardBody>
    </Card>
  );
}
