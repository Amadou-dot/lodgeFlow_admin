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
import { useResourceLoad } from '@/hooks/useResourceLoad';
import { useCallback, useEffect, useState } from 'react';
import { usePermission } from './AuthGuard';
import { utcDate } from '@/lib/reservation-options';
type Reservation = DiningReservationDetail | ExperienceReservationDetail;
interface ReservationDetailProps {
  kind: 'dining' | 'experience';
  id: string;
}
interface ReservationData {
  reservation: Reservation;
  customerName: string;
  allowedStatuses: string[];
  payment: PaymentSummary;
  currency: string;
}
function isStatusAllowed({
  data,
  status,
}: {
  data: ReservationData;
  status: string;
}) {
  return (
    data.allowedStatuses.includes(status) &&
    (status !== 'cancelled' ||
      !(
        data.payment.legacyPaid ||
        data.payment.refundableCents > 0 ||
        data.reservation.checkout?.pending ||
        data.reservation.stripeRefund?.status === 'pending'
      ))
  );
}
export function ReservationDetail(props: ReservationDetailProps) {
  return (
    <ReservationDetailContent key={`${props.kind}:${props.id}`} {...props} />
  );
}
function ReservationDetailContent({ kind, id }: ReservationDetailProps) {
  const canManage = usePermission('bookings:manage');
  const endpoint = `/api/${kind === 'dining' ? 'dining-reservations' : 'experience-bookings'}/${id}`;
  const [nextStatus, setNextStatus] = useState('');
  const [action, setAction] = useState<
    { kind: 'idle' } | { kind: 'saving' } | { kind: 'error'; message: string }
  >({ kind: 'idle' });
  const request = useCallback(
    async (signal: AbortSignal): Promise<ReservationData> => {
      const response = await fetch(endpoint, { cache: 'no-store', signal });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error || 'Unable to load reservation');
      return result.data;
    },
    [endpoint]
  );
  const { state, reload: load } = useResourceLoad({
    resourceKey: endpoint,
    request,
  });
  const data = state.data;
  const validDraft = !!data && isStatusAllowed({ data, status: nextStatus });
  useEffect(() => {
    if (data)
      setNextStatus(current =>
        isStatusAllowed({ data, status: current }) ? current : ''
      );
  }, [data]);
  const busy = action.kind === 'saving';
  const error =
    action.kind === 'error'
      ? action.message
      : state.kind === 'error'
        ? state.message
        : '';
  async function save() {
    if (!data || busy || !validDraft) return;
    const submittedStatus = nextStatus;
    setAction({ kind: 'saving' });
    try {
      const response = await fetch(endpoint, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: submittedStatus,
          expectedStatus: data.reservation.status,
        }),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error || 'Unable to update status');
      await load();
      setNextStatus(current => (current === submittedStatus ? '' : current));
      setAction({ kind: 'idle' });
    } catch (e) {
      setAction({
        kind: 'error',
        message: e instanceof Error ? e.message : 'Unable to update status',
      });
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
      {state.kind === 'error' && (
        <button
          onClick={() => {
            setAction({ kind: 'idle' });
            void load().catch(() => {});
          }}
        >
          Retry
        </button>
      )}
      {!data || !reservation ? (
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
            key={endpoint}
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
                  value={validDraft ? nextStatus : ''}
                  disabled={busy}
                  onChange={e => setNextStatus(e.target.value)}
                >
                  <option value=''>Choose status</option>
                  {data.allowedStatuses.map(status => (
                    <option
                      key={status}
                      disabled={!isStatusAllowed({ data, status })}
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
                disabled={busy || !validDraft}
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
