'use client';

import { Accordion, AccordionItem } from '@heroui/accordion';
import { Button } from '@heroui/button';
import { Checkbox } from '@heroui/checkbox';
import { Divider } from '@heroui/divider';
import { DatePicker } from '@heroui/date-picker';
import { Link } from '@heroui/link';
import { CalendarDate, getLocalTimeZone, today } from '@internationalized/date';
import { useState } from 'react';
import { useSettings } from '@/hooks/useSettings';

interface CabinPricingCalculatorProps {
  discount: number;
  price: number;
}

export default function CabinPricingCalculator({
  discount,
  price,
}: CabinPricingCalculatorProps) {
  const [checkIn, setCheckIn] = useState<CalendarDate | null>(null);
  const [checkOut, setCheckOut] = useState<CalendarDate | null>(null);
  const [hasBreakfast, setHasBreakfast] = useState(false);
  const [hasPets, setHasPets] = useState(false);
  const [hasParking, setHasParking] = useState(false);
  const [hasEarlyCheckIn, setHasEarlyCheckIn] = useState(false);
  const [hasLateCheckOut, setHasLateCheckOut] = useState(false);

  const { data: settings } = useSettings();

  const todayDate = today(getLocalTimeZone());
  const effectiveRate = price - discount;
  const hasDiscount = discount > 0;

  const validNights =
    checkIn && checkOut
      ? checkOut.compare(checkIn) > 0
        ? checkOut.compare(checkIn)
        : null
      : null;

  const cabinSubtotal =
    validNights !== null ? effectiveRate * validNights : null;
  const savings =
    hasDiscount && validNights !== null ? discount * validNights : null;

  const breakfastFee =
    hasBreakfast && settings?.breakfastPrice && validNights !== null
      ? settings.breakfastPrice * validNights
      : 0;
  const petFee =
    hasPets && settings?.petFee && validNights !== null
      ? settings.petFee * validNights
      : 0;
  const parkingFee =
    hasParking && settings?.parkingFee && validNights !== null
      ? settings.parkingFee * validNights
      : 0;
  const earlyCheckInFee =
    hasEarlyCheckIn && settings?.earlyCheckInFee ? settings.earlyCheckInFee : 0;
  const lateCheckOutFee =
    hasLateCheckOut && settings?.lateCheckOutFee ? settings.lateCheckOutFee : 0;
  const extrasTotal =
    breakfastFee + petFee + parkingFee + earlyCheckInFee + lateCheckOutFee;
  const grandTotal =
    cabinSubtotal !== null ? cabinSubtotal + extrasTotal : null;

  const handleReset = () => {
    setCheckIn(null);
    setCheckOut(null);
    setHasBreakfast(false);
    setHasEarlyCheckIn(false);
    setHasLateCheckOut(false);
    setHasParking(false);
    setHasPets(false);
  };

  const title = (
    <div className='flex items-center gap-2'>
      <span className='text-base font-bold'>Price Calculator</span>
      {hasDiscount && (
        <span className='text-sm text-default-400 line-through'>
          ${price.toFixed(2)}/night
        </span>
      )}
      <span className='font-bold text-success'>
        ${effectiveRate.toFixed(2)}/night
      </span>
      {hasDiscount && (
        <span className='font-semibold text-sm text-success'>
          Save ${discount.toFixed(2)}/night
        </span>
      )}
    </div>
  );

  return (
    <Accordion className='w-full' variant='bordered'>
      <AccordionItem
        key='calculator'
        aria-label='Price Calculator'
        title={title}
      >
        <div className='space-y-4 pb-2'>
          <div className='grid grid-cols-1 gap-3 sm:grid-cols-2'>
            <DatePicker
              label='Check-in'
              minValue={todayDate}
              showMonthAndYearPickers
              value={checkIn}
              onChange={setCheckIn}
            />
            <DatePicker
              isDisabled={!checkIn}
              label='Check-out'
              minValue={checkIn ? checkIn.add({ days: 1 }) : todayDate}
              showMonthAndYearPickers
              value={checkOut}
              onChange={setCheckOut}
            />
          </div>

          <div className='grid grid-cols-1 gap-2 sm:grid-cols-2'>
            {settings?.breakfastPrice && (
              <Checkbox
                color='success'
                isSelected={hasBreakfast}
                onValueChange={setHasBreakfast}
              >
                Breakfast
                {` (+$${settings.breakfastPrice}/night)`}
              </Checkbox>
            )}
            {settings?.allowPets !== false && settings?.petFee && (
              <Checkbox
                color='success'
                isSelected={hasPets}
                onValueChange={setHasPets}
              >
                Pets
                {` (+$${settings.petFee}/night)`}
              </Checkbox>
            )}
            {!settings?.parkingIncluded && settings?.parkingFee && (
              <Checkbox
                color='success'
                isSelected={hasParking}
                onValueChange={setHasParking}
              >
                Parking
                {` (+$${settings.parkingFee}/night)`}
              </Checkbox>
            )}
            {settings?.earlyCheckInFee && (
              <Checkbox
                color='success'
                isSelected={hasEarlyCheckIn}
                onValueChange={setHasEarlyCheckIn}
              >
                Early check-in
                {` (+$${settings.earlyCheckInFee})`}
              </Checkbox>
            )}
            {settings?.lateCheckOutFee && (
              <Checkbox
                color='success'
                isSelected={hasLateCheckOut}
                onValueChange={setHasLateCheckOut}
              >
                Late check-out
                {` (+$${settings.lateCheckOutFee})`}
              </Checkbox>
            )}
          </div>

          {validNights !== null && grandTotal !== null ? (
            <>
              <Divider />
              <div className='space-y-2'>
                <div className='flex items-center justify-between text-sm'>
                  <span>
                    ${effectiveRate.toFixed(2)} &times; {validNights} night
                    {validNights > 1 ? 's' : ''}
                  </span>
                  <span>${cabinSubtotal!.toFixed(2)}</span>
                </div>

                {savings !== null && savings > 0 && (
                  <div className='flex items-center justify-between rounded-lg bg-success-50 px-3 py-2 text-sm font-semibold text-success'>
                    <span>Savings</span>
                    <span>-${savings.toFixed(2)}</span>
                  </div>
                )}

                {breakfastFee > 0 && (
                  <div className='flex items-center justify-between text-sm'>
                    <span>Breakfast</span>
                    <span>+${breakfastFee.toFixed(2)}</span>
                  </div>
                )}
                {petFee > 0 && (
                  <div className='flex items-center justify-between text-sm'>
                    <span>Pet fee</span>
                    <span>+${petFee.toFixed(2)}</span>
                  </div>
                )}
                {parkingFee > 0 && (
                  <div className='flex items-center justify-between text-sm'>
                    <span>Parking</span>
                    <span>+${parkingFee.toFixed(2)}</span>
                  </div>
                )}
                {earlyCheckInFee > 0 && (
                  <div className='flex items-center justify-between text-sm'>
                    <span>Early check-in</span>
                    <span>+${earlyCheckInFee.toFixed(2)}</span>
                  </div>
                )}
                {lateCheckOutFee > 0 && (
                  <div className='flex items-center justify-between text-sm'>
                    <span>Late check-out</span>
                    <span>+${lateCheckOutFee.toFixed(2)}</span>
                  </div>
                )}

                <Divider />

                <div className='flex items-center justify-between font-bold text-base'>
                  <span>Total</span>
                  <span className='text-success'>${grandTotal.toFixed(2)}</span>
                </div>
              </div>
            </>
          ) : (
            <p className='text-sm text-default-500'>
              Select check-in and check-out dates to see pricing.
            </p>
          )}

          <div className='flex flex-col gap-2 pt-1 sm:flex-row'>
            <Button
              as={Link}
              className='flex-1'
              color='primary'
              href='#booking'
              size='lg'
            >
              Book Now
            </Button>
            <Button
              className='sm:w-auto'
              color='default'
              size='lg'
              variant='flat'
              onPress={handleReset}
            >
              Clear Dates
            </Button>
          </div>
        </div>
      </AccordionItem>
    </Accordion>
  );
}
