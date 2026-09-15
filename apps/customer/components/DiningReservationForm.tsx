'use client';

import { useState } from 'react';
import { Button } from '@heroui/button';
import { Card, CardBody, CardHeader } from '@heroui/card';
import { DatePicker } from '@heroui/date-picker';
import { Input } from '@heroui/input';
import { Select, SelectItem } from '@heroui/select';
import { Textarea } from '@heroui/input';
import { addToast } from '@heroui/toast';
import { getLocalTimeZone, today, CalendarDate } from '@internationalized/date';
import { useUser } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { AlertTriangle, Calendar, Users } from 'lucide-react';

import {
  useCreateDiningReservation,
  useDiningAvailability,
} from '@/hooks/useDiningReservation';
import type { Dining } from '@/types';

interface DiningReservationFormProps {
  dining: Dining;
}

function generateTimeSlots(start: string, end: string): string[] {
  const [startHour, startMin] = start.split(':').map(Number);
  const [endHour, endMin] = end.split(':').map(Number);
  const startMinutes = startHour * 60 + startMin;
  const endMinutes = endHour * 60 + endMin;

  const slots: string[] = [];
  for (let m = startMinutes; m <= endMinutes; m += 30) {
    const hour = Math.floor(m / 60);
    const min = m % 60;
    slots.push(
      `${hour.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`
    );
  }
  return slots;
}

const tablePreferences = [
  { key: 'no-preference', label: 'No Preference' },
  { key: 'indoor', label: 'Indoor' },
  { key: 'outdoor', label: 'Outdoor' },
  { key: 'bar', label: 'Bar' },
];

export default function DiningReservationForm({
  dining,
}: DiningReservationFormProps) {
  const { user } = useUser();
  const router = useRouter();
  const createReservation = useCreateDiningReservation();

  const [date, setDate] = useState<CalendarDate | null>(null);
  const [time, setTime] = useState('');
  const [numGuests, setNumGuests] = useState(dining.minPeople || 1);
  const [tablePreference, setTablePreference] = useState('no-preference');
  const [dietaryRequirements, setDietaryRequirements] = useState('');
  const [specialRequests, setSpecialRequests] = useState('');
  const [occasion, setOccasion] = useState('');

  const todayDate = today(getLocalTimeZone());
  const totalPrice = dining.price * numGuests;
  const timeSlots = generateTimeSlots(
    dining.servingTime.start,
    dining.servingTime.end
  );

  // Convert CalendarDate to string for availability check
  const dateString = date
    ? `${date.year}-${String(date.month).padStart(2, '0')}-${String(date.day).padStart(2, '0')}`
    : undefined;

  const { data: availability, isLoading: isCheckingAvailability } =
    useDiningAvailability(dining._id.toString(), dateString, time || undefined);

  const isFullyBooked = availability?.isAvailable === false;
  const insufficientSeats =
    availability && availability.seatsRemaining < numGuests;

  const handleSubmit = async () => {
    if (!user) {
      addToast({
        title: 'Sign In Required',
        description: 'Please sign in to make a reservation.',
        color: 'warning',
      });
      return;
    }

    if (!date) {
      addToast({
        title: 'Date Required',
        description: 'Please select a date for your reservation.',
        color: 'warning',
      });
      return;
    }

    if (!time) {
      addToast({
        title: 'Time Required',
        description: 'Please select a time for your reservation.',
        color: 'warning',
      });
      return;
    }

    try {
      const reservationDate = date.toDate(getLocalTimeZone());

      const result = await createReservation.mutateAsync({
        diningId: dining._id.toString(),
        date: reservationDate,
        time,
        numGuests,
        dietaryRequirements: dietaryRequirements
          ? dietaryRequirements.split('\n').filter(Boolean)
          : [],
        specialRequests: specialRequests
          ? specialRequests.split('\n').filter(Boolean)
          : [],
        tablePreference: tablePreference as
          'indoor' | 'outdoor' | 'bar' | 'no-preference',
        occasion: occasion || undefined,
      });

      addToast({
        title: 'Reservation Created!',
        description: 'Your dining reservation has been submitted.',
        color: 'success',
      });

      router.push(`/dining/confirmation/${result.data._id}`);
    } catch (error) {
      addToast({
        title: 'Reservation Failed',
        description:
          error instanceof Error
            ? error.message
            : 'Failed to create reservation. Please try again.',
        color: 'danger',
      });
    }
  };

  return (
    <Card>
      <CardHeader>
        <h2 className='text-xl font-bold'>Make a Reservation</h2>
      </CardHeader>
      <CardBody className='space-y-6'>
        {/* Price Display */}
        <div className='text-center'>
          <div className='text-3xl font-bold text-primary'>${dining.price}</div>
          <div className='text-sm text-default-600'>per person</div>
        </div>

        {/* Date Picker */}
        <DatePicker
          granularity='day'
          isRequired
          label='Select Date'
          minValue={todayDate}
          value={date}
          onChange={setDate}
        />

        {/* Time Selection */}
        <Select
          isRequired
          label='Select Time'
          placeholder='Choose a time slot'
          selectedKeys={time ? [time] : []}
          onSelectionChange={keys => {
            const selected = Array.from(keys)[0] as string;
            setTime(selected || '');
          }}
        >
          {timeSlots.map(slot => (
            <SelectItem key={slot}>{slot}</SelectItem>
          ))}
        </Select>

        {/* Availability Warning */}
        {date &&
          time &&
          !isCheckingAvailability &&
          (isFullyBooked || insufficientSeats) && (
            <div className='flex items-center gap-2 p-3 bg-warning-50 border border-warning-200 rounded-lg text-warning-700'>
              <AlertTriangle className='w-4 h-4 flex-shrink-0' />
              <span className='text-sm'>
                {isFullyBooked
                  ? 'This time slot is fully booked. Please select a different time.'
                  : `Only ${availability?.seatsRemaining} seat${availability?.seatsRemaining === 1 ? '' : 's'} remaining. Please reduce the number of guests or select a different time.`}
              </span>
            </div>
          )}

        {/* Availability Info */}
        {date &&
          time &&
          !isCheckingAvailability &&
          availability?.isAvailable &&
          !insufficientSeats && (
            <div className='flex items-center gap-2 p-3 bg-success-50 border border-success-200 rounded-lg text-success-700'>
              <span className='text-sm'>
                {availability.seatsRemaining} seat
                {availability.seatsRemaining === 1 ? '' : 's'} available
              </span>
            </div>
          )}

        {/* Number of Guests */}
        <Input
          isRequired
          label='Number of Guests'
          max={dining.maxPeople}
          min={dining.minPeople || 1}
          startContent={<Users className='w-4 h-4 text-default-400' />}
          type='number'
          value={numGuests.toString()}
          onChange={e => {
            const val = parseInt(e.target.value) || dining.minPeople || 1;
            setNumGuests(
              Math.min(Math.max(val, dining.minPeople || 1), dining.maxPeople)
            );
          }}
        />
        <p className='text-xs text-default-400 -mt-4'>
          {dining.minPeople > 1 ? `${dining.minPeople}-` : '1-'}
          {dining.maxPeople} guests
        </p>

        {/* Table Preference */}
        <Select
          label='Table Preference'
          placeholder='Choose seating preference'
          selectedKeys={[tablePreference]}
          onSelectionChange={keys => {
            const selected = Array.from(keys)[0] as string;
            setTablePreference(selected || 'no-preference');
          }}
        >
          {tablePreferences.map(pref => (
            <SelectItem key={pref.key}>{pref.label}</SelectItem>
          ))}
        </Select>

        {/* Occasion */}
        <Input
          label='Occasion'
          placeholder='e.g., Birthday, Anniversary, Business Dinner...'
          value={occasion}
          onChange={e => setOccasion(e.target.value)}
        />

        {/* Dietary Requirements */}
        <Textarea
          label='Dietary Requirements'
          placeholder='Any allergies or dietary restrictions (one per line)...'
          value={dietaryRequirements}
          onChange={e => setDietaryRequirements(e.target.value)}
        />

        {/* Special Requests */}
        <Textarea
          label='Special Requests'
          placeholder='Any other requests or notes (one per line)...'
          value={specialRequests}
          onChange={e => setSpecialRequests(e.target.value)}
        />

        {/* Price Summary */}
        <div className='bg-default-100 rounded-lg p-4 space-y-2'>
          <div className='flex justify-between text-sm'>
            <span>
              ${dining.price} x {numGuests} guest
              {numGuests > 1 ? 's' : ''}
            </span>
            <span>${totalPrice}</span>
          </div>
          <div className='flex justify-between font-bold text-lg border-t border-default-200 pt-2'>
            <span>Total</span>
            <span className='text-success'>${totalPrice}</span>
          </div>
        </div>

        {/* Submit Button */}
        <Button
          className='w-full'
          color='primary'
          isLoading={createReservation.isPending}
          size='lg'
          isDisabled={
            isFullyBooked || insufficientSeats || isCheckingAvailability
          }
          startContent={
            !createReservation.isPending && <Calendar className='w-4 h-4' />
          }
          onPress={handleSubmit}
        >
          {isCheckingAvailability ? 'Checking availability...' : 'Reserve Now'}
        </Button>

        {/* Serving Time Info */}
        <p className='text-xs text-default-500 text-center'>
          Serving hours: {dining.servingTime.start} - {dining.servingTime.end}
        </p>
      </CardBody>
    </Card>
  );
}
