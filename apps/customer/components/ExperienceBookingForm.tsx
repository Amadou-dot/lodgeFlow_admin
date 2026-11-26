'use client';

import { CreateAttemptRecovery } from './CreateAttemptRecovery';
import {
  useCreateAttempt,
  missingCreatedDetail,
} from '@/hooks/useCreateAttempt';
import { openReservationCheckout } from '@/lib/open-reservation-checkout';
import { useState } from 'react';
import { Button } from '@heroui/button';
import { Card, CardBody, CardHeader } from '@heroui/card';
import { DatePicker } from '@heroui/date-picker';
import { Input } from '@heroui/input';
import { Textarea } from '@heroui/input';
import { addToast } from '@heroui/toast';
import { getLocalTimeZone, today, CalendarDate } from '@internationalized/date';
import { useUser } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { Calendar, Users } from 'lucide-react';

import { useCreateExperienceBooking } from '@/hooks/useExperienceBooking';
import type { Experience } from '@/types';

interface ExperienceBookingFormProps {
  experience: Experience;
}

export default function ExperienceBookingForm({
  experience,
}: ExperienceBookingFormProps) {
  const { user } = useUser();
  const router = useRouter();
  const createAttempt = useCreateAttempt(experience._id);
  const createBooking = useCreateExperienceBooking(experience._id);

  const [date, setDate] = useState<CalendarDate | null>(null);
  const [numParticipants, setNumParticipants] = useState(1);
  const [specialRequests, setSpecialRequests] = useState('');
  const [observations, setObservations] = useState('');

  const todayDate = today(getLocalTimeZone());
  const totalPrice = experience.price * numParticipants;

  const handleSubmit = async () => {
    if (!user) {
      addToast({
        title: 'Sign In Required',
        description: 'Please sign in to book this experience.',
        color: 'warning',
      });
      return;
    }

    if (!date) {
      addToast({
        title: 'Date Required',
        description: 'Please select a date for your experience.',
        color: 'warning',
      });
      return;
    }

    if (!experience._id) {
      addToast({
        title: 'Booking Failed',
        description: 'This experience is missing an identifier.',
        color: 'danger',
      });
      return;
    }

    const bookingDate = date.toDate(getLocalTimeZone());

    const attempt = createAttempt.begin();
    if (!attempt) return;
    try {
      const result = await createBooking.mutateAsync({
        experienceId: experience._id.toString(),
        date: bookingDate.toISOString(),
        numParticipants,
        specialRequests: specialRequests
          ? specialRequests.split('\n').filter(Boolean)
          : [],
        observations: observations || undefined,
      });

      if (!attempt.current()) return;
      if (result.data === null) {
        attempt.missingDetail();
        addToast({
          title: 'Request saved',
          description: missingCreatedDetail,
          color: 'warning',
        });
        return;
      }
      const confirmationUrl = `/experiences/confirmation/${result.data._id}`;
      attempt.confirmed(confirmationUrl);
      addToast({
        title: 'Booking Created!',
        description: 'Your experience booking has been submitted.',
        color: 'success',
      });

      if (result.data.totalPrice > 0 && !result.data.isPaid) {
        try {
          await openReservationCheckout({
            kind: 'experience',
            id: result.data._id,
            isCurrent: attempt.current,
          });
        } catch {
          if (!attempt.current()) return;
          addToast({
            title: 'Payment still required',
            description:
              'Your reservation was saved. Continue payment from the confirmation page.',
            color: 'warning',
          });
          router.push(confirmationUrl);
        }
      } else router.push(confirmationUrl);
    } catch (error) {
      const notice = attempt.failed(error);
      if (notice) addToast(notice);
    }
  };

  return (
    <Card>
      <CardHeader>
        <h2 className='text-xl font-bold'>Book This Experience</h2>
      </CardHeader>
      <CardBody className='space-y-6'>
        {/* Price Display */}
        <div className='text-center'>
          <div className='text-3xl font-bold text-primary'>
            ${experience.price}
          </div>
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

        {/* Participants */}
        <Input
          isRequired
          label='Number of Participants'
          max={experience.maxParticipants || 20}
          min={1}
          startContent={<Users className='w-4 h-4 text-default-400' />}
          type='number'
          value={numParticipants.toString()}
          onChange={e => {
            const val = parseInt(e.target.value) || 1;
            setNumParticipants(Math.min(val, experience.maxParticipants || 20));
          }}
        />
        {experience.maxParticipants && (
          <p className='text-xs text-default-400 -mt-4'>
            Maximum {experience.maxParticipants} participants per session
          </p>
        )}

        {/* Special Requests */}
        <Textarea
          label='Special Requests'
          placeholder='Any special requests or accommodations needed...'
          value={specialRequests}
          onChange={e => setSpecialRequests(e.target.value)}
        />

        {/* Observations */}
        <Input
          label='Additional Notes'
          placeholder='Anything else we should know...'
          value={observations}
          onChange={e => setObservations(e.target.value)}
        />

        {/* Price Summary */}
        <div className='bg-default-100 rounded-lg p-4 space-y-2'>
          <div className='flex justify-between text-sm'>
            <span>
              ${experience.price} x {numParticipants} participant
              {numParticipants > 1 ? 's' : ''}
            </span>
            <span>${totalPrice}</span>
          </div>
          <div className='flex justify-between font-bold text-lg border-t border-default-200 pt-2'>
            <span>Total</span>
            <span className='text-success'>${totalPrice}</span>
          </div>
        </div>

        <CreateAttemptRecovery recovery={createAttempt.recovery} />
        {/* Submit Button */}
        <Button
          className='w-full'
          color='primary'
          isDisabled={createAttempt.blocked}
          isLoading={createBooking.isPending}
          size='lg'
          startContent={
            !createBooking.isPending && <Calendar className='w-4 h-4' />
          }
          onPress={handleSubmit}
        >
          Book Experience
        </Button>

        {/* Info */}
        {experience.cancellationPolicy && (
          <p className='text-xs text-default-500 text-center'>
            {experience.cancellationPolicy}
          </p>
        )}
      </CardBody>
    </Card>
  );
}
