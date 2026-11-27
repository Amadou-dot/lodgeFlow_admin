'use client';
import { useState } from 'react';
import type {
  PaymentAttempt,
  PaymentDraft,
  useReservationPaymentAttempt,
} from '@/hooks/useReservationPaymentAttempt';
import { usePermission } from './AuthGuard';
import { reservationReceiptSchema } from '@/lib/validations/reservation-payment';
import {
  readReservationPayment,
  receiptConfirmation,
  type ReservationData,
  type ReservationKind,
  type ReservationPaymentFields,
  type PaymentSummary,
} from '@/lib/validations/reservation-operations-json';
import { StaffRequestRejected } from '@/lib/validations/staff-request-rejected';
import {
  cents,
  centsToMajor,
  formatCents,
  majorAmount,
  majorToCents,
  MoneyError,
} from '@lodgeflow/database/money';
export function ReservationPayments({
  kind,
  endpoint,
  reservationId,
  payment,
  currency,
  receipts,
  checkout,
  stripeRefund,
  status,
  reload,
  submission,
}: ReservationPaymentFields & {
  kind: ReservationKind;
  endpoint: string;
  reservationId: string;
  payment: PaymentSummary;
  currency: string | null;
  status: string | null;
  reload: () => Promise<ReservationData | undefined>;
  submission: ReturnType<typeof useReservationPaymentAttempt>;
}) {
  const canManage = usePermission('bookings:manage');
  const canRefund = usePermission('refunds:issue');
  const [draft, setDraft] = useState<PaymentDraft>({
    type: 'payment',
    method: 'cash',
    amount: '',
    reference: '',
  });
  const { type, method, amount, reference } = draft;
  const { state, setState, request, manualCorrection, sending } = submission;
  const correction = manualCorrection.current;
  const replay = state.kind === 'uncertain' ? state.attempt : correction;
  const currencyCode = currency || 'USD';
  function format(value: number) {
    const amount = cents(value);
    try {
      return /^[a-z]{3}$/i.test(currencyCode)
        ? formatCents({ amount, currency: currencyCode })
        : `${centsToMajor(amount)} ${currencyCode}`;
    } catch (error) {
      if (!(error instanceof MoneyError)) throw error;
      // Some safe integer cents have no exact numeric major-unit representation.
      return `${amount} cents (${currencyCode})`;
    }
  }
  const retryDetails =
    stripeRefund?.status === 'pending' &&
    stripeRefund.token &&
    typeof stripeRefund.reference === 'string'
      ? {
          token: stripeRefund.token,
          amountCents: stripeRefund.amountCents,
          reference: stripeRefund.reference,
        }
      : undefined;
  async function submit(retry?: NonNullable<typeof retryDetails>) {
    if (sending.current || state.kind === 'busy' || state.kind === 'uncertain')
      return;
    if (correction && !retry && method === 'stripe') {
      setState({
        kind: 'error',
        message:
          'Finish reconciling the manual receipt before issuing a Stripe refund.',
      });
      return;
    }
    let transaction;
    try {
      if (!retry && !/^\d+(\.\d{1,2})?$/.test(amount)) {
        throw new MoneyError('Invalid amount');
      }
      transaction = retry
        ? {
            type: 'refund' as const,
            method: 'stripe' as const,
            amountCents: cents(retry.amountCents, {
              sign: 'positive',
            }),
            reference: retry.reference,
          }
        : {
            type,
            method,
            amountCents: majorToCents({
              amount: majorAmount(Number(amount), {
                precision: 'exact',
                sign: 'positive',
              }),
              rounding: 'exact',
            }),
            reference,
          };
    } catch (error) {
      if (!(error instanceof MoneyError)) throw error;
      setState({
        kind: 'error',
        message: 'Enter a positive amount with at most two decimal places',
      });
      return;
    }
    const body = JSON.stringify(transaction);
    const id =
      retry?.token ??
      correction?.transaction.id ??
      (request.current?.body === body
        ? request.current.transaction.id
        : crypto.randomUUID());
    const proposed = { ...transaction, id };
    const checked = reservationReceiptSchema.safeParse(proposed);
    if (!checked.success) {
      setState({ kind: 'error', message: checked.error.issues[0].message });
      return;
    }
    // The server trims the reference. Keep the original body for exact replay.
    const attempt = { body, transaction: proposed, draft };
    request.current = attempt;
    await send(attempt, 'submit');
  }
  async function send(attempt: PaymentAttempt, action: 'submit' | 'replay') {
    if (sending.current) return;
    sending.current = true;
    setState({ kind: 'busy' });
    let acknowledged = false;
    try {
      const response = await fetch(`${endpoint}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(attempt.transaction),
      });
      await readReservationPayment(response, {
        kind,
        reservationId,
        transaction: attempt.transaction,
      });
      acknowledged = true;
      if (!(await reload())) throw new Error('Unable to refresh reservation');
      complete(attempt);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to record transaction';
      if (!acknowledged && error instanceof StaffRequestRejected) {
        await handleRejection({ attempt, action, error });
      } else {
        setState({ kind: 'uncertain', attempt, message });
      }
    } finally {
      sending.current = false;
    }
  }
  async function handleRejection({
    attempt,
    action,
    error,
  }: {
    attempt: PaymentAttempt;
    action: 'submit' | 'replay';
    error: StaffRequestRejected;
  }) {
    const { transaction } = attempt;
    const correcting =
      transaction.method !== 'stripe' &&
      manualCorrection.current?.transaction.id === transaction.id;
    const firstSubmission = action === 'submit' && !correcting;
    const rejected = { kind: 'error', message: error.message } as const;
    const uncertain = {
      kind: 'uncertain',
      attempt,
      message: error.message,
    } as const;
    const checkLedger =
      transaction.method === 'stripe'
        ? [400, 404, 409].includes(error.status)
        : !firstSubmission && [400, 409].includes(error.status);
    if (!checkLedger) return setState(firstSubmission ? rejected : uncertain);

    const detail = await reload().catch(() => undefined);
    if (!detail) return setState(uncertain);
    const { receipts, stripeRefund } = detail.reservation;
    const receipt = receiptConfirmation(receipts, transaction);
    if (receipt.kind === 'confirmed') return complete(attempt);
    if (receipt.kind === 'conflict') {
      if (!correcting) return setState(uncertain);
      // A delayed submission won the race with the correction.
      request.current = undefined;
      manualCorrection.current = undefined;
      const { method, type, amountCents } = receipt.recorded;
      return setState({
        kind: 'error',
        message: `This receipt already records a ${method} ${type} of ${format(amountCents)}. Review the updated balance.`,
      });
    }
    if (transaction.method !== 'stripe') {
      // An absent receipt permits an edit, but a delayed original write can
      // still arrive. Keep every correction on the original manual receipt ID.
      manualCorrection.current = attempt;
      return setState(rejected);
    }
    if (
      firstSubmission &&
      (stripeRefund?.token !== transaction.id ||
        stripeRefund.status === 'failed')
    )
      return setState(rejected);
    setState(uncertain);
  }
  function complete(attempt: PaymentAttempt) {
    request.current = undefined;
    if (attempt.transaction.method !== 'stripe')
      manualCorrection.current = undefined;
    if (!manualCorrection.current)
      setDraft(current =>
        current === attempt.draft
          ? { ...current, amount: '', reference: '' }
          : current
      );
    setState({ kind: 'idle' });
  }
  const pending = checkout?.pending || stripeRefund?.status === 'pending';
  return (
    <section className='space-y-4'>
      <h2 className='text-xl font-semibold'>Payments and refunds</h2>
      <dl className='grid grid-cols-2 gap-2'>
        <dt>Total</dt>
        <dd>{format(payment.totalCents)}</dd>
        <dt>Received</dt>
        <dd>{format(payment.paidCents)}</dd>
        <dt>Outstanding balance</dt>
        <dd>{format(payment.balanceCents)}</dd>
        <dt>Refunded</dt>
        <dd>{format(payment.refundedCents)}</dd>
      </dl>
      {payment.legacyPaid && (
        <p>
          Historical payment requires staff reconciliation before a refund can
          be recorded.
        </p>
      )}
      {checkout?.pending && (
        <p>
          Online checkout is pending. The guest can resume checkout from their
          confirmation page.
        </p>
      )}
      {stripeRefund?.status === 'pending' && (
        <div>
          <p>Online refund is pending.</p>
          {canRefund && retryDetails && state.kind !== 'uncertain' && (
            <button
              disabled={state.kind === 'busy'}
              onClick={() => void submit(retryDetails)}
              className='underline'
            >
              Check or retry refund
            </button>
          )}
        </div>
      )}
      {stripeRefund?.status === 'failed' && (
        <p role='alert'>
          The online refund failed. Review it in Stripe before submitting a new
          refund.
        </p>
      )}
      {(state.kind === 'error' || state.kind === 'uncertain') && (
        <p role='alert' className='text-danger'>
          {state.message}
        </p>
      )}
      {replay &&
        state.kind !== 'busy' &&
        canManage &&
        (replay.transaction.type === 'payment' || canRefund) && (
          <div>
            <p>
              {state.kind === 'uncertain'
                ? 'Retry the original'
                : 'Correct the amount or retry the original'}{' '}
              {format(replay.transaction.amountCents)}{' '}
              {replay.transaction.method.replace('_', ' ')}{' '}
              {replay.transaction.type} to confirm its outcome. Your edits will
              be kept.
            </p>
            <button
              type='button'
              className='underline'
              onClick={() => void send(replay, 'replay')}
            >
              Retry original transaction
            </button>
          </div>
        )}
      {canManage && !payment.legacyPaid && !pending && (
        <form
          className='space-y-3'
          onSubmit={e => {
            e.preventDefault();
            void submit();
          }}
        >
          <label className='block'>
            Transaction
            <select
              className='block border rounded p-2 bg-background'
              value={type}
              onChange={e => {
                const value = e.target.value;
                if (value === 'payment' || value === 'refund')
                  setDraft(current => ({
                    ...current,
                    type: value,
                    method: 'cash',
                  }));
              }}
            >
              <option value='payment'>Record payment received</option>
              {canRefund && <option value='refund'>Refund</option>}
            </select>
          </label>
          <label className='block'>
            Method
            <select
              className='block border rounded p-2 bg-background'
              value={method}
              onChange={e => {
                const value = e.target.value;
                if (
                  value === 'cash' ||
                  value === 'bank_transfer' ||
                  value === 'card' ||
                  value === 'stripe'
                )
                  setDraft(current => ({ ...current, method: value }));
              }}
            >
              <option value='cash'>Cash</option>
              <option value='bank_transfer'>Bank transfer</option>
              <option value='card'>External card terminal</option>
              {type === 'refund' && (
                <option value='stripe' disabled={!!correction}>
                  Stripe online payment
                </option>
              )}
            </select>
          </label>
          <label className='block'>
            Amount ({currencyCode})
            <input
              className='block border rounded p-2 bg-background'
              inputMode='decimal'
              required
              value={amount}
              onChange={e => {
                const value = e.target.value;
                setDraft(current => ({ ...current, amount: value }));
              }}
            />
          </label>
          <label className='block'>
            Receipt reference / refund reason
            <input
              className='block border rounded p-2 bg-background'
              maxLength={200}
              required={method !== 'cash' || type === 'refund'}
              value={reference}
              onChange={e => {
                const value = e.target.value;
                setDraft(current => ({ ...current, reference: value }));
              }}
            />
          </label>
          <p className='text-sm'>
            {method === 'stripe'
              ? 'This sends a refund to the original payment method through Stripe.'
              : 'Record only money already received or returned outside this app.'}
          </p>
          <button
            className='rounded bg-primary text-primary-foreground px-4 py-2 disabled:opacity-40'
            disabled={
              state.kind === 'busy' ||
              state.kind === 'uncertain' ||
              (type === 'payment'
                ? payment.balanceCents <= 0 ||
                  status === 'cancelled' ||
                  status === 'no-show'
                : !canRefund || payment.refundableCents <= 0)
            }
          >
            {state.kind === 'busy'
              ? 'Saving…'
              : method === 'stripe'
                ? 'Issue Stripe refund'
                : type === 'payment'
                  ? 'Record payment'
                  : 'Record refund'}
          </button>
        </form>
      )}
      {!!receipts?.length && (
        <ul className='space-y-2'>
          {receipts.map(receipt => (
            <li key={receipt.id}>
              {receipt.type === 'payment' ? 'Payment' : 'Refund'} ·{' '}
              {format(receipt.amountCents)} · {receipt.method} ·{' '}
              {new Date(receipt.recordedAt).toLocaleString()}
              {receipt.reference && ` · ${receipt.reference}`}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
