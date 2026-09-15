import { Card, CardBody, CardHeader } from '@heroui/card';

interface ExtrasCardProps {
  extras: {
    hasBreakfast: boolean;
    breakfastPrice?: number;
    hasPets: boolean;
    petFee?: number;
    hasParking: boolean;
    parkingFee?: number;
    hasEarlyCheckIn: boolean;
    earlyCheckInFee?: number;
    hasLateCheckOut: boolean;
    lateCheckOutFee?: number;
  };
}

export default function ExtrasCard({ extras }: ExtrasCardProps) {
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
              <span className='font-medium'>${extras.breakfastPrice}</span>
            </div>
          )}
          {extras.hasPets && (
            <div className='flex justify-between items-center'>
              <span>Pet Fee</span>
              <span className='font-medium'>${extras.petFee}</span>
            </div>
          )}
          {extras.hasParking && (
            <div className='flex justify-between items-center'>
              <span>Parking</span>
              <span className='font-medium'>${extras.parkingFee}</span>
            </div>
          )}
          {extras.hasEarlyCheckIn && (
            <div className='flex justify-between items-center'>
              <span>Early Check-in</span>
              <span className='font-medium'>${extras.earlyCheckInFee}</span>
            </div>
          )}
          {extras.hasLateCheckOut && (
            <div className='flex justify-between items-center'>
              <span>Late Check-out</span>
              <span className='font-medium'>${extras.lateCheckOutFee}</span>
            </div>
          )}
        </div>
      </CardBody>
    </Card>
  );
}
