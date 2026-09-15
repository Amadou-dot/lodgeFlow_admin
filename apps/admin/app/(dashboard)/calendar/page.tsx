'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { utcDate } from '@/lib/reservation-options';
interface Resource {
  _id: string;
  name: string;
  status?: string;
  isAvailable?: boolean;
  maxPeople?: number;
  maxParticipants?: number;
}
interface Stay {
  _id: string;
  cabin: string;
  checkInDate: string;
  checkOutDate: string;
  status: string;
}
interface Usage {
  _id: { resourceId: string; date: string; time?: string };
  used: number;
}
interface CalendarData {
  start: string;
  end: string;
  resources: Resource[];
  reservations?: Stay[];
  usage?: Usage[];
}
const DAY = 86_400_000;
const colors: Record<string, string> = {
  unconfirmed: 'bg-warning-100',
  confirmed: 'bg-primary-100',
  'checked-in': 'bg-success-100',
  'checked-out': 'bg-default-200',
};
export default function CalendarPage() {
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  });
  const [kind, setKind] = useState<'cabins' | 'dining' | 'experiences'>(
    'cabins'
  );
  const [data, setData] = useState<CalendarData | null>(null),
    [error, setError] = useState(''),
    [loading, setLoading] = useState(true);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    const end = new Date(
      Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 1)
    );
    const params = new URLSearchParams({
      start: month.toISOString(),
      end: end.toISOString(),
    });
    fetch(`/api/calendar/${kind}?${params}`, {
      signal: controller.signal,
      cache: 'no-store',
    })
      .then(async response => {
        const result = await response.json();
        if (!response.ok)
          throw new Error(result.error || 'Unable to load calendar');
        if (!controller.signal.aborted) setData(result.data);
      })
      .catch(e => {
        if (!controller.signal.aborted) setError(e.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [month, kind]);
  const move = (offset: number) =>
    setMonth(
      new Date(
        Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + offset, 1)
      )
    );
  const days: string[] = [];
  if (data)
    for (
      let day = new Date(data.start).getTime();
      day < new Date(data.end).getTime();
      day += DAY
    )
      days.push(new Date(day).toISOString().slice(0, 10));
  function cabinCells(resource: Resource) {
    const stays = (data?.reservations ?? []).filter(
      stay => stay.cabin === resource._id
    );
    const cells = [];
    for (let index = 0; index < days.length;) {
      const day = days[index];
      const stay = stays.find(
        item =>
          utcDate(item.checkInDate) <= day && utcDate(item.checkOutDate) > day
      );
      if (!stay) {
        cells.push(
          <td
            key={day}
            className='border border-default-200 h-14'
            title={`${resource.name}: available ${day}`}
          />
        );
        index++;
        continue;
      }
      let span = 1;
      while (
        index + span < days.length &&
        days[index + span] < utcDate(stay.checkOutDate)
      )
        span++;
      cells.push(
        <td
          key={day}
          colSpan={span}
          className={`border border-default-200 p-1 ${colors[stay.status] || 'bg-default-100'}`}
        >
          <Link
            className='block rounded p-2 text-xs underline truncate'
            href={'/bookings/' + stay._id}
            title={`${stay.status}: ${utcDate(stay.checkInDate)} to ${utcDate(stay.checkOutDate)}`}
          >
            {stay.status}
          </Link>
        </td>
      );
      index += span;
    }
    return cells;
  }
  function capacityCell(resource: Resource, day: string) {
    const usage = (data?.usage ?? []).filter(
      item => item._id.resourceId === resource._id && item._id.date === day
    );
    const type = kind === 'dining' ? 'dining' : 'experience';
    const capacity =
      kind === 'dining' ? resource.maxPeople : resource.maxParticipants;
    const params = new URLSearchParams({
      type,
      from: day,
      to: new Date(new Date(day).getTime() + DAY).toISOString().slice(0, 10),
      resourceId: resource._id,
    });
    return (
      <td key={day} className='border border-default-200 p-2 align-top text-xs'>
        <Link
          href={'/reservations?' + params}
          className='block space-y-1'
          title={`Open ${resource.name} reservations on ${day}`}
        >
          {!usage.length ? (
            <span className='text-default-500'>
              0 booked
              {capacity == null
                ? ' · uncapped'
                : kind === 'experiences'
                  ? ` / ${capacity}`
                  : ''}
            </span>
          ) : (
            usage.map(item => (
              <div
                key={item._id.time || 'day'}
                className={
                  capacity != null && item.used >= capacity
                    ? 'rounded bg-warning-100 p-1'
                    : ''
                }
              >
                {item._id.time && (
                  <strong>
                    {item._id.time}
                    <br />
                  </strong>
                )}
                {item.used} / {capacity ?? 'uncapped'}
              </div>
            ))
          )}
        </Link>
      </td>
    );
  }
  return (
    <section className='space-y-6'>
      <div className='flex justify-between gap-3'>
        <h1 className='text-2xl font-semibold'>Occupancy calendar</h1>
        <Link className='text-primary underline' href='/reservations'>
          Reservations inbox
        </Link>
      </div>
      <div className='flex flex-wrap items-center gap-3'>
        <button className='rounded border px-3 py-2' onClick={() => move(-1)}>
          Previous month
        </button>
        <h2 className='text-xl'>
          {month.toLocaleDateString(undefined, {
            month: 'long',
            year: 'numeric',
            timeZone: 'UTC',
          })}
        </h2>
        <button className='rounded border px-3 py-2' onClick={() => move(1)}>
          Next month
        </button>
        <label className='ml-auto'>
          View{' '}
          <select
            className='border rounded bg-background p-2'
            value={kind}
            onChange={e => setKind(e.target.value as typeof kind)}
          >
            <option value='cabins'>Cabins</option>
            <option value='dining'>Dining</option>
            <option value='experiences'>Experiences</option>
          </select>
        </label>
      </div>
      <p className='text-sm'>
        {kind === 'cabins'
          ? 'Stays occupy check-in through the night before checkout. Click a stay to open its booking.'
          : kind === 'dining'
            ? 'Seats are counted separately for each seating time. Click a day to open its reservations.'
            : 'Participants are counted per day. Uncapped experiences have no configured participant limit.'}{' '}
        Dates use UTC.
      </p>
      {kind === 'cabins' && (
        <div className='flex flex-wrap gap-3 text-xs'>
          {Object.entries(colors).map(([status, color]) => (
            <span key={status} className={`rounded px-2 py-1 ${color}`}>
              {status}
            </span>
          ))}
        </div>
      )}
      {error && (
        <p role='alert' className='text-danger'>
          {error}
        </p>
      )}
      {loading ? (
        <p>Loading calendar…</p>
      ) : (
        data &&
        !error && (
          <div className='overflow-auto rounded border border-default-200'>
            <table
              className='w-full table-fixed text-left'
              style={{ minWidth: 180 + days.length * 90 }}
            >
              <thead>
                <tr>
                  <th className='sticky left-0 z-10 w-44 bg-background p-3'>
                    Listing
                  </th>
                  {days.map(day => (
                    <th
                      className='border border-default-200 p-2 text-xs'
                      key={day}
                    >
                      {day.slice(8)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.resources.map(resource => (
                  <tr key={resource._id}>
                    <th className='sticky left-0 z-10 bg-background border border-default-200 p-3 text-sm'>
                      {resource.name}
                      {kind === 'dining' && (
                        <div className='font-normal text-xs'>
                          {resource.maxPeople} seats per seating
                        </div>
                      )}
                      {((resource.status && resource.status !== 'active') ||
                        resource.isAvailable === false) && (
                        <div className='font-normal text-xs'>
                          Unavailable for new bookings
                        </div>
                      )}
                    </th>
                    {kind === 'cabins'
                      ? cabinCells(resource)
                      : days.map(day => capacityCell(resource, day))}
                  </tr>
                ))}
              </tbody>
            </table>
            {!data.resources.length && <p className='p-4'>No listings yet.</p>}
          </div>
        )
      )}
    </section>
  );
}
