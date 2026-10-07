'use client';
import {
  ReservationPayments,
  type PaymentSummary,
} from './ReservationPayments';
import type {
  DiningReservationDetail,
  ExperienceReservationDetail,
} from '@lodgeflow/database/reservation-json';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { usePermission } from './AuthGuard';
import { utcDate } from '@/lib/reservation-options';
type Reservation = DiningReservationDetail | ExperienceReservationDetail;
export function ReservationDetail({
  kind,
  id,
}: {
  kind: 'dining' | 'experience';
  id: string;
}) {
  const canManage = usePermission('bookings:manage');
  const endpoint = `/api/${kind === 'dining' ? 'dining-reservations' : 'experience-bookings'}/${id}`;
  const [data, setData] = useState<{
    reservation: Reservation;
    customerName: string;
    allowedStatuses: string[];
    payment: PaymentSummary;
    currency: string;
  } | null>(null);
  const [nextStatus, setNextStatus] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    const response = await fetch(endpoint, { cache: 'no-store' });
    const result = await response.json();
    if (!response.ok)
      throw new Error(result.error || 'Unable to load reservation');
    setData(result.data);
    setNextStatus('');
  }, [endpoint]);
  useEffect(() => {
    load().catch(e => setError(e.message));
  }, [load]);
  async function save() {
    if (!data) return;
    setBusy(true);
    setError('');
    try {
      const response = await fetch(endpoint, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: nextStatus,
          expectedStatus: data.reservation.status,
        }),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error || 'Unable to update status');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to update status');
    } finally {
      setBusy(false);
    }
  }
  const reservation = data?.reservation;
  const dining =
    reservation && 'dining' in reservation ? reservation : undefined;
  const experience =
    reservation && 'experience' in reservation ? reservation : undefined;
  return (
    <section className='space-y-6 max-w-3xl'>
      <Link href='/reservations' className='text-primary underline'>
        Back to reservations
      </Link>
      <h1 className='text-2xl font-semibold capitalize'>{kind} reservation</h1>
      {error && (
        <p role='alert' className='text-danger'>
          {error}
        </p>
      )}
      {!reservation ? (
        !error && <p>Loading reservation…</p>
      ) : (
        <>
          <h2 className='text-xl'>
            {dining?.dining?.name ||
              experience?.experience?.name ||
              'Removed listing'}
          </h2>
          <dl className='grid grid-cols-2 gap-3'>
            <dt>Guest</dt>
            <dd>{data.customerName}</dd>
            <dt>Date</dt>
            <dd>{utcDate(reservation.date)}</dd>
            <dt>Time</dt>
            <dd>{dining?.time || experience?.timeSlot || 'Not specified'}</dd>
            <dt>Party size</dt>
            <dd>{dining?.numGuests ?? experience?.numParticipants}</dd>
            <dt>Status</dt>
            <dd>{reservation.status}</dd>
            <dt>Payment</dt>
            <dd>{reservation.isPaid ? 'Paid' : 'Balance due'}</dd>
          </dl>
          {!!dining?.dietaryRequirements?.length && (
            <p>
              Dietary requirements: {dining?.dietaryRequirements.join(', ')}
            </p>
          )}
          {!!reservation.specialRequests?.length && (
            <p>Special requests: {reservation.specialRequests.join(', ')}</p>
          )}
          {experience?.observations && <p>Notes: {experience?.observations}</p>}
          <ReservationPayments
            endpoint={endpoint}
            payment={data.payment}
            currency={data.currency}
            receipts={reservation.receipts}
            checkout={reservation.checkout}
            stripeRefund={reservation.stripeRefund}
            status={reservation.status}
            reload={load}
          />
          {canManage && !!data.allowedStatuses.length && (
            <div className='space-y-3'>
              <label className='flex flex-col gap-1'>
                Change status
                <select
                  className='border rounded p-2 bg-background'
                  value={nextStatus}
                  disabled={busy}
                  onChange={e => setNextStatus(e.target.value)}
                >
                  <option value=''>Choose status</option>
                  {data.allowedStatuses.map(status => (
                    <option
                      key={status}
                      disabled={
                        status === 'cancelled' &&
                        (data.payment.legacyPaid ||
                          data.payment.refundableCents > 0 ||
                          reservation.checkout?.pending ||
                          reservation.stripeRefund?.status === 'pending')
                      }
                    >
                      {status}
                    </option>
                  ))}
                </select>
              </label>
              {(data.payment.legacyPaid || data.payment.refundableCents > 0) &&
                data.allowedStatuses.includes('cancelled') && (
                  <p className='text-sm'>
                    Paid reservations require refund reconciliation before
                    cancellation.
                  </p>
                )}
              <button
                className='rounded bg-primary text-primary-foreground px-4 py-2 disabled:opacity-40'
                disabled={busy || !nextStatus}
                onClick={() => void save()}
              >
                {busy ? 'Saving…' : 'Save status'}
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
