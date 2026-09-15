'use client';
import { useCabinAvailability } from '@/hooks/useCabinAvailability';
import { Card, CardBody, CardHeader } from '@heroui/card';
import { Skeleton } from '@heroui/skeleton';
import { useState } from 'react';

interface Props {
  cabinId: string;
}

const DAY_NAMES = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

function parseLocalDate(dateStr: string): number {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).getTime();
}

function isDateUnavailable(
  date: Date,
  ranges: { start: string; end: string }[]
): boolean {
  const ts = date.getTime();
  return ranges.some(
    ({ end, start }) => ts >= parseLocalDate(start) && ts < parseLocalDate(end)
  );
}

function MonthCalendar({
  month,
  unavailableRanges,
  year,
}: {
  month: number;
  unavailableRanges: { start: string; end: string }[];
  year: number;
}) {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthName = new Date(year, month, 1).toLocaleString('default', {
    month: 'long',
    year: 'numeric',
  });
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  return (
    <div className='min-w-[220px]'>
      <p className='mb-2 text-center text-sm font-semibold'>{monthName}</p>
      <div className='grid grid-cols-7 gap-0.5'>
        {DAY_NAMES.map(d => (
          <div
            key={d}
            className='py-0.5 text-center text-xs text-foreground-400'
          >
            {d}
          </div>
        ))}
        {cells.map((day, idx) => {
          if (!day) return <div key={`empty-${idx}`} />;
          const date = new Date(year, month, day);
          const isPast = date < today;
          const unavailable =
            !isPast && isDateUnavailable(date, unavailableRanges);
          return (
            <div
              key={day}
              className={`rounded py-0.5 text-center text-xs ${
                isPast
                  ? 'text-foreground-300'
                  : unavailable
                    ? 'bg-danger-100 text-danger-600'
                    : 'bg-success-100 text-success-700'
              }`}
            >
              {day}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function CabinAvailabilityPreview({ cabinId }: Props) {
  const { data, isError, isLoading } = useCabinAvailability(cabinId);
  const [now] = useState(() => new Date());

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <h3 className='text-lg font-semibold'>Availability</h3>
        </CardHeader>
        <CardBody>
          <div data-testid='availability-skeleton'>
            <Skeleton className='h-40 w-full rounded-lg' />
          </div>
        </CardBody>
      </Card>
    );
  }

  if (isError) {
    return (
      <Card>
        <CardHeader>
          <h3 className='text-lg font-semibold'>Availability</h3>
        </CardHeader>
        <CardBody>
          <p className='text-sm text-foreground-500'>
            Unable to load availability. Please refresh the page to try again.
          </p>
        </CardBody>
      </Card>
    );
  }

  const unavailableRanges = data?.unavailableDates ?? [];
  const months = [
    { month: now.getMonth(), year: now.getFullYear() },
    {
      month: (now.getMonth() + 1) % 12,
      year: now.getMonth() === 11 ? now.getFullYear() + 1 : now.getFullYear(),
    },
  ];

  return (
    <Card>
      <CardHeader>
        <h3 className='text-lg font-semibold'>Availability</h3>
      </CardHeader>
      <CardBody className='space-y-4'>
        <div className='flex flex-wrap gap-6'>
          {months.map(({ month, year }) => (
            <MonthCalendar
              key={`${year}-${month}`}
              month={month}
              unavailableRanges={unavailableRanges}
              year={year}
            />
          ))}
        </div>
        <div className='flex gap-4 pt-2 text-xs'>
          <span className='flex items-center gap-1'>
            <span className='inline-block h-3 w-3 rounded bg-success-100' />
            Available
          </span>
          <span className='flex items-center gap-1'>
            <span className='inline-block h-3 w-3 rounded bg-danger-100' />
            Booked
          </span>
        </div>
      </CardBody>
    </Card>
  );
}
