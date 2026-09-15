'use client';
import { useRef, useState } from 'react';
import { usePermission } from './AuthGuard';
import type {
  ReservationReceipt,
  ReservationPaymentState,
} from '@lodgeflow/database';
export interface PaymentSummary {
  totalCents: number;
  paidCents: number;
  refundedCents: number;
  balanceCents: number;
  refundableCents: number;
  legacyPaid: boolean;
}
export function ReservationPayments({
  endpoint,
  payment,
  currency,
  receipts,
  checkout,
  stripeRefund,
  status,
  reload,
}: ReservationPaymentState & {
  endpoint: string;
  payment: PaymentSummary;
  currency: string;
  status: string;
  reload: () => Promise<void>;
}) {
  const canManage = usePermission('bookings:manage');
  const canRefund = usePermission('refunds:issue');
  const [type, setType] = useState<'payment' | 'refund'>('payment');
  const [method, setMethod] = useState<ReservationReceipt['method']>('cash');
  const [amount, setAmount] = useState('');
  const [reference, setReference] = useState('');
  const [state, setState] = useState<
    { kind: 'idle' } | { kind: 'busy' } | { kind: 'error'; message: string }
  >({ kind: 'idle' });
  const request = useRef<{ body: string; id: string }>();
  const format = (cents: number) =>
    new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(
      cents / 100
    );
  async function submit(retry = false) {
    const transaction =
      retry && stripeRefund
        ? {
            type: 'refund',
            method: 'stripe',
            amountCents: stripeRefund.amountCents,
            reference: stripeRefund.reference,
          }
        : {
            type,
            method,
            amountCents: Math.round(Number(amount) * 100),
            reference,
          };
    if (
      !retry &&
      (!/^\d+(\.\d{1,2})?$/.test(amount) || transaction.amountCents <= 0)
    ) {
      setState({
        kind: 'error',
        message: 'Enter a positive amount with at most two decimal places',
      });
      return;
    }
    const body = JSON.stringify(transaction);
    if (request.current?.body !== body)
      request.current = {
        body,
        id: retry && stripeRefund ? stripeRefund.token : crypto.randomUUID(),
      };
    setState({ kind: 'busy' });
    try {
      const response = await fetch(`${endpoint}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...transaction, id: request.current!.id }),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error || 'Unable to record transaction');
      await reload();
      request.current = undefined;
      setAmount('');
      setReference('');
      setState({ kind: 'idle' });
    } catch (error) {
      setState({
        kind: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Unable to record transaction',
      });
    }
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
          {canRefund && (
            <button
              disabled={state.kind === 'busy'}
              onClick={() => void submit(true)}
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
      {state.kind === 'error' && (
        <p role='alert' className='text-danger'>
          {state.message}
        </p>
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
                setType(e.target.value as 'payment' | 'refund');
                setMethod('cash');
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
              onChange={e =>
                setMethod(e.target.value as ReservationReceipt['method'])
              }
            >
              <option value='cash'>Cash</option>
              <option value='bank_transfer'>Bank transfer</option>
              <option value='card'>External card terminal</option>
              {type === 'refund' && (
                <option value='stripe'>Stripe online payment</option>
              )}
            </select>
          </label>
          <label className='block'>
            Amount ({currency})
            <input
              className='block border rounded p-2 bg-background'
              inputMode='decimal'
              required
              value={amount}
              onChange={e => setAmount(e.target.value)}
            />
          </label>
          <label className='block'>
            Receipt reference / refund reason
            <input
              className='block border rounded p-2 bg-background'
              maxLength={200}
              required={method !== 'cash' || type === 'refund'}
              value={reference}
              onChange={e => setReference(e.target.value)}
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
              (type === 'payment'
                ? payment.balanceCents <= 0 ||
                  ['cancelled', 'no-show'].includes(status)
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
