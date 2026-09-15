'use client';
import {
  OperationsPage,
  OperationsSelect,
  OperationsLoading,
  OperationsError,
  OperationsPagination,
} from '@/components/OperationsPage';
import { Card, CardBody } from '@heroui/card';
import { Input } from '@heroui/input';
import { Chip } from '@heroui/chip';
import { useEffect, useState } from 'react';
type Event = {
  _id: string;
  actor: string;
  actorRole: string;
  action: string;
  resourceType: string;
  resourceId: string;
  createdAt: string;
  before: Record<string, unknown>;
  after: Record<string, unknown>;
};
export default function AuditPage() {
  const [filters, setFilters] = useState({
    actor: '',
    action: '',
    resourceId: '',
    from: '',
    to: '',
  });
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{
    events: Event[];
    total: number;
    actions: string[];
  }>({ events: [], total: 0, actions: [] });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    const params = new URLSearchParams({ page: String(page), limit: '25' });
    for (const [key, value] of Object.entries(filters))
      if (value)
        params.set(key, key === 'to' ? `${value}T23:59:59.999Z` : value);
    fetch('/api/audit?' + params, {
      signal: controller.signal,
      cache: 'no-store',
    })
      .then(async response => {
        const result = await response.json();
        if (!response.ok)
          throw new Error(result.error || 'Unable to load history');
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
  return (
    <OperationsPage
      title='Audit history'
      description='Review staff changes to bookings, payments, cabins, settings, and access. Date filters use UTC.'
    >
      <Card>
        <CardBody className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4'>
          {(['actor', 'resourceId', 'from', 'to'] as const).map(key => (
            <Input
              key={key}
              label={
                {
                  actor: 'Staff user ID',
                  resourceId: 'Resource ID',
                  from: 'From',
                  to: 'Through',
                }[key]
              }
              size='sm'
              variant='bordered'
              type={key === 'from' || key === 'to' ? 'date' : 'text'}
              value={filters[key]}
              onValueChange={value => {
                setFilters({ ...filters, [key]: value });
                setPage(1);
              }}
            />
          ))}
          <OperationsSelect
            label='Action'
            value={filters.action}
            onChange={value => {
              setFilters({ ...filters, action: value });
              setPage(1);
            }}
            options={[
              { value: '', label: 'All actions' },
              ...data.actions.map(action => ({ value: action, label: action })),
            ]}
          />
        </CardBody>
      </Card>
      <OperationsError message={error} />
      {loading ? (
        <OperationsLoading label='Loading history…' />
      ) : (
        !error && (
          <>
            <p className='text-sm'>{data.total} events</p>
            {!data.events.length && (
              <Card className='bg-default-50'>
                <CardBody className='text-center py-16 text-default-600'>
                  No events match these filters.
                </CardBody>
              </Card>
            )}
            <div className='space-y-3'>
              {data.events.map(event => (
                <Card
                  as='article'
                  key={event._id}
                  className='border border-divider'
                >
                  <CardBody className='space-y-3 p-5'>
                    <div className='flex flex-wrap justify-between gap-2'>
                      <Chip size='sm' variant='flat' color='primary'>
                        {event.action}
                      </Chip>
                      <time
                        className='text-sm text-default-500'
                        dateTime={event.createdAt}
                      >
                        {new Date(event.createdAt).toLocaleString()}
                      </time>
                    </div>
                    <p className='text-sm break-all'>
                      {event.actor} ({event.actorRole}) · {event.resourceType}:{' '}
                      {event.resourceId}
                    </p>
                    <dl className='text-sm'>
                      {Object.keys(event.after).map(field => (
                        <div
                          className='grid gap-2 md:grid-cols-3 border-t border-default-100 py-2'
                          key={field}
                        >
                          <dt className='font-medium'>{field}</dt>
                          <dd className='break-all'>
                            <span className='text-default-500 mr-2'>
                              Before:
                            </span>
                            {JSON.stringify(event.before[field]) ?? '—'}
                          </dd>
                          <dd className='break-all'>
                            <span className='text-default-500 mr-2'>
                              After:
                            </span>
                            {JSON.stringify(event.after[field]) ?? '—'}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </CardBody>
                </Card>
              ))}
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
