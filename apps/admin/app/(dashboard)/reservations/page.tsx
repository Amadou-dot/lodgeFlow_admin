'use client';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useSettings } from '@/hooks/useSettings';
import {
  LIFECYCLES,
  RESERVATION_TYPES,
  reservationHref,
  utcDate,
  type ReservationRow,
} from '@/lib/reservation-options';
export default function ReservationsPage() {
  const search = useSearchParams();
  const [filters, setFilters] = useState({
    type: search.get('type') ?? '',
    lifecycle: '',
    resourceId: search.get('resourceId') ?? '',
    from: search.get('from') ?? new Date().toISOString().slice(0, 10),
    to: search.get('to') ?? '',
  });
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{ rows: ReservationRow[]; total: number }>({
    rows: [],
    total: 0,
  });
  const [error, setError] = useState(''),
    [loading, setLoading] = useState(true);
  const { data: settings } = useSettings();
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    const params = new URLSearchParams({ page: String(page), limit: '25' });
    for (const [key, value] of Object.entries(filters))
      if (value) params.set(key, value);
    fetch('/api/reservations?' + params, {
      signal: controller.signal,
      cache: 'no-store',
    })
      .then(async response => {
        const result = await response.json();
        if (!response.ok)
          throw new Error(result.error || 'Unable to load reservations');
        if (!controller.signal.aborted) setData(result.data);
      })
      .catch(e => {
        if (!controller.signal.aborted) setError(e.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [filters, page]);
  const setFilter = (key: keyof typeof filters, value: string) => {
    setFilters({ ...filters, [key]: value });
    setPage(1);
  };
  return (
    <section className='space-y-6'>
      <div className='flex justify-between gap-3'>
        <h1 className='text-2xl font-semibold'>Reservations</h1>
        <Link className='text-primary underline' href='/calendar'>
          Occupancy calendar
        </Link>
      </div>
      <p>
        Cabin stays, dining seatings, and experiences in one list. Reservation
        dates use UTC.
      </p>
      <div className='flex flex-wrap gap-3'>
        <label className='flex flex-col gap-1'>
          Type
          <select
            className='border rounded bg-background p-2'
            value={filters.type}
            onChange={e => setFilter('type', e.target.value)}
          >
            <option value=''>All types</option>
            {RESERVATION_TYPES.map(type => (
              <option key={type}>{type}</option>
            ))}
          </select>
        </label>
        <label className='flex flex-col gap-1'>
          Status group
          <select
            className='border rounded bg-background p-2'
            value={filters.lifecycle}
            onChange={e => setFilter('lifecycle', e.target.value)}
          >
            <option value=''>All statuses</option>
            {LIFECYCLES.map(status => (
              <option key={status} value={status}>
                {status.replace('_', ' ')}
              </option>
            ))}
          </select>
        </label>
        <label className='flex flex-col gap-1'>
          From
          <input
            className='border rounded bg-background p-2'
            type='date'
            value={filters.from}
            onChange={e => setFilter('from', e.target.value)}
          />
        </label>
        <label className='flex flex-col gap-1'>
          Before
          <input
            className='border rounded bg-background p-2'
            type='date'
            value={filters.to}
            onChange={e => setFilter('to', e.target.value)}
          />
        </label>
      </div>
      {filters.resourceId && (
        <button
          className='text-primary underline'
          onClick={() => setFilter('resourceId', '')}
        >
          Clear selected listing filter
        </button>
      )}
      {error && (
        <p role='alert' className='text-danger'>
          {error}
        </p>
      )}
      {loading ? (
        <p>Loading reservations…</p>
      ) : (
        !error && (
          <>
            <p className='text-sm'>{data.total} reservations</p>
            <div className='overflow-x-auto'>
              <table className='w-full text-left text-sm'>
                <thead>
                  <tr>
                    {[
                      'Date / time',
                      'Type',
                      'Reservation',
                      'Guest',
                      'Party',
                      'Status',
                      'Payment',
                    ].map(label => (
                      <th className='p-3' key={label}>
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map(row => (
                    <tr
                      className='border-t border-default-200'
                      key={row.type + ':' + row._id}
                    >
                      <td className='p-3 whitespace-nowrap'>
                        {utcDate(row.date)}
                        {row.endDate && <> – {utcDate(row.endDate)}</>}
                        {row.time && <div>{row.time}</div>}
                      </td>
                      <td className='p-3 capitalize'>{row.type}</td>
                      <td className='p-3'>
                        <Link
                          className='text-primary underline'
                          href={reservationHref(row.type, row._id)}
                        >
                          {row.resourceName}
                        </Link>
                      </td>
                      <td className='p-3'>
                        <Link
                          href={'/guests/' + row.customer}
                          className='underline'
                        >
                          {row.customerName}
                        </Link>
                      </td>
                      <td className='p-3'>{row.partySize}</td>
                      <td className='p-3'>{row.status}</td>
                      <td className='p-3 whitespace-nowrap'>
                        {new Intl.NumberFormat(undefined, {
                          style: 'currency',
                          currency: settings?.currency || 'USD',
                        }).format(row.totalPrice)}
                        <div>{row.isPaid ? 'Paid' : 'Balance due'}</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!data.rows.length && <p>No reservations match these filters.</p>}
          </>
        )
      )}
      <div className='flex items-center gap-4'>
        <button
          className='rounded border px-3 py-2 disabled:opacity-40'
          disabled={loading || page <= 1}
          onClick={() => setPage(page - 1)}
        >
          Previous
        </button>
        <span>Page {page}</span>
        <button
          className='rounded border px-3 py-2 disabled:opacity-40'
          disabled={loading || page * 25 >= data.total}
          onClick={() => setPage(page + 1)}
        >
          Next
        </button>
      </div>
    </section>
  );
}
