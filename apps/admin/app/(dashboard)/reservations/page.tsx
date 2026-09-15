'use client';
import {
  OperationsPage,
  OperationsSelect,
  OperationsLoading,
  OperationsError,
  OperationsPagination,
} from '@/components/OperationsPage';
import { Button } from '@heroui/button';
import { Card, CardBody } from '@heroui/card';
import { Input } from '@heroui/input';
import { Chip } from '@heroui/chip';
import {
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
} from '@heroui/table';
import { formatCurrency } from '@/utils/utilityFunctions';
import { getStatusColor } from '@/utils/bookingUtils';
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
    <OperationsPage
      title='Reservations'
      description='Manage cabin stays, dining seatings, and experiences. Reservation dates use UTC.'
      action={
        <Button as={Link} href='/calendar' color='primary' variant='flat'>
          Occupancy calendar
        </Button>
      }
    >
      <Card>
        <CardBody className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4'>
          <OperationsSelect
            label='Type'
            value={filters.type}
            onChange={value => setFilter('type', value)}
            options={[
              { value: '', label: 'All types' },
              ...RESERVATION_TYPES.map(type => ({
                value: type,
                label: type.charAt(0).toUpperCase() + type.slice(1),
              })),
            ]}
          />
          <OperationsSelect
            label='Status group'
            value={filters.lifecycle}
            onChange={value => setFilter('lifecycle', value)}
            options={[
              { value: '', label: 'All statuses' },
              ...LIFECYCLES.map(status => ({
                value: status,
                label: status.replace('_', ' '),
              })),
            ]}
          />
          <Input
            label='From'
            type='date'
            size='sm'
            variant='bordered'
            value={filters.from}
            onValueChange={value => setFilter('from', value)}
          />
          <Input
            label='Before'
            type='date'
            size='sm'
            variant='bordered'
            value={filters.to}
            onValueChange={value => setFilter('to', value)}
          />
        </CardBody>
      </Card>
      {filters.resourceId && (
        <Button
          color='primary'
          variant='light'
          onPress={() => setFilter('resourceId', '')}
        >
          Clear selected listing filter
        </Button>
      )}
      <OperationsError message={error} />
      {loading ? (
        <OperationsLoading label='Loading reservations…' />
      ) : (
        !error && (
          <>
            <p className='text-sm'>{data.total} reservations</p>
            <div className='overflow-x-auto'>
              <Table
                aria-label='Reservations'
                classNames={{
                  wrapper: 'border border-divider',
                  th: 'bg-default-100 text-default-600',
                  td: 'py-3',
                }}
              >
                <TableHeader>
                  {[
                    'Date / time',
                    'Type',
                    'Reservation',
                    'Guest',
                    'Party',
                    'Status',
                    'Payment',
                  ].map(label => (
                    <TableColumn key={label}>{label}</TableColumn>
                  ))}
                </TableHeader>
                <TableBody emptyContent='No reservations match these filters.'>
                  {data.rows.map(row => (
                    <TableRow
                      className='border-t border-default-200'
                      key={row.type + ':' + row._id}
                    >
                      <TableCell className='p-3 whitespace-nowrap'>
                        {utcDate(row.date)}
                        {row.endDate && <> – {utcDate(row.endDate)}</>}
                        {row.time && <div>{row.time}</div>}
                      </TableCell>
                      <TableCell className='p-3 capitalize'>
                        {row.type}
                      </TableCell>
                      <TableCell className='p-3'>
                        <Link
                          className='text-primary hover:underline font-medium'
                          href={reservationHref(row.type, row._id)}
                        >
                          {row.resourceName}
                        </Link>
                      </TableCell>
                      <TableCell className='p-3'>
                        <Link
                          href={'/guests/' + row.customer}
                          className='underline'
                        >
                          {row.customerName}
                        </Link>
                      </TableCell>
                      <TableCell className='p-3'>{row.partySize}</TableCell>
                      <TableCell className='p-3'>
                        <Chip
                          size='sm'
                          variant='flat'
                          color={getStatusColor(row.status)}
                        >
                          {row.status}
                        </Chip>
                      </TableCell>
                      <TableCell className='p-3 whitespace-nowrap'>
                        {formatCurrency(row.totalPrice, settings?.currency)}
                        <div className='mt-1'>
                          <Chip
                            size='sm'
                            variant='flat'
                            color={row.isPaid ? 'success' : 'warning'}
                          >
                            {row.isPaid ? 'Paid' : 'Balance due'}
                          </Chip>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )
      )}
      <OperationsPagination
        page={page}
        total={data.total}
        loading={loading}
        onChange={setPage}
      />
    </OperationsPage>
  );
}
