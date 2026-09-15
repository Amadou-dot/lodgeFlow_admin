'use client';
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
    <section className='space-y-6'>
      <h1 className='text-2xl font-semibold'>Audit history</h1>
      <p>
        Staff changes to bookings, payments, cabins, settings, and access. Dates
        are filtered in UTC.
      </p>
      <div className='flex flex-wrap gap-3'>
        {(['actor', 'resourceId', 'from', 'to'] as const).map(key => (
          <label key={key} className='flex flex-col gap-1 text-sm'>
            {
              {
                actor: 'Staff user ID',
                resourceId: 'Resource ID',
                from: 'From',
                to: 'Through',
              }[key]
            }
            <input
              className='rounded border bg-background p-2'
              type={key === 'from' || key === 'to' ? 'date' : 'text'}
              value={filters[key]}
              onChange={e => {
                setFilters({ ...filters, [key]: e.target.value });
                setPage(1);
              }}
            />
          </label>
        ))}
        <label className='flex flex-col gap-1 text-sm'>
          Action
          <select
            className='rounded border bg-background p-2'
            value={filters.action}
            onChange={e => {
              setFilters({ ...filters, action: e.target.value });
              setPage(1);
            }}
          >
            <option value=''>All actions</option>
            {data.actions.map(action => (
              <option key={action}>{action}</option>
            ))}
          </select>
        </label>
      </div>
      {error && (
        <p role='alert' className='text-danger'>
          {error}
        </p>
      )}
      {loading ? (
        <p>Loading history…</p>
      ) : (
        !error && (
          <>
            <p className='text-sm'>{data.total} events</p>
            {!data.events.length && <p>No events match these filters.</p>}
            <div className='space-y-3'>
              {data.events.map(event => (
                <article
                  key={event._id}
                  className='rounded-lg border border-default-200 p-4 space-y-2'
                >
                  <div className='flex flex-wrap justify-between gap-2'>
                    <strong>{event.action}</strong>
                    <time>{new Date(event.createdAt).toLocaleString()}</time>
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
                          {JSON.stringify(event.before[field])}
                        </dd>
                        <dd className='break-all'>
                          {JSON.stringify(event.after[field])}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </article>
              ))}
            </div>
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
