import { Card, CardBody, CardHeader } from '@heroui/card';
import { Divider } from '@heroui/divider';
import { format } from 'date-fns';
import { formatCurrency } from '@/utils/utilityFunctions';

interface PaymentSummaryCardProps {
  numNights: number;
  cabinPrice: number;
  extrasPrice: number;
  totalPrice: number;
  depositPaid: boolean;
  depositAmount: number;
  remainingAmount: number;
  paymentMethod?: string;
  paidAt?: string;
  stripeSessionId?: string;
  stripePaymentIntentId?: string;
  paymentConfirmationSentAt?: string;
  refundStatus?: string;
  refundAmount?: number;
  refundedAt?: string;
}

export default function PaymentSummaryCard({
  numNights,
  cabinPrice,
  extrasPrice,
  totalPrice,
  depositPaid,
  depositAmount,
  remainingAmount,
  paymentMethod,
  paidAt,
  stripeSessionId,
  stripePaymentIntentId,
  paymentConfirmationSentAt,
  refundStatus,
  refundAmount,
  refundedAt,
}: PaymentSummaryCardProps) {
  const formatDateTime = (dateValue: string) => {
    const date = new Date(dateValue);
    if (isNaN(date.getTime())) return 'Invalid date';
    return format(date, 'MMM dd, yyyy h:mm a');
  };

  const hasPaymentMetadata =
    paidAt ||
    stripeSessionId ||
    stripePaymentIntentId ||
    paymentConfirmationSentAt;
  const hasRefundMetadata = refundStatus && refundStatus !== 'none';

  return (
    <Card>
      <CardHeader>
        <h2 className='text-lg font-semibold'>Payment Summary</h2>
      </CardHeader>
      <CardBody className='space-y-3'>
        <div className='space-y-2 text-sm'>
          <div className='flex justify-between'>
            <span>Cabin ({numNights} nights)</span>
            <span>{formatCurrency(cabinPrice)}</span>
          </div>
          {extrasPrice > 0 && (
            <div className='flex justify-between'>
              <span>Extras</span>
              <span>{formatCurrency(extrasPrice)}</span>
            </div>
          )}
          <Divider />
          <div className='flex justify-between font-semibold'>
            <span>Total</span>
            <span>{formatCurrency(totalPrice)}</span>
          </div>
        </div>

        <Divider />

        <div className='space-y-2 text-sm'>
          {depositPaid && (
            <div className='flex justify-between text-success'>
              <span>Deposit Paid</span>
              <span>{formatCurrency(depositAmount)}</span>
            </div>
          )}
          <div className='flex justify-between'>
            <span>Remaining</span>
            <span
              className={remainingAmount > 0 ? 'text-warning' : 'text-success'}
            >
              {formatCurrency(remainingAmount)}
            </span>
          </div>
        </div>

        {paymentMethod && (
          <div className='pt-2'>
            <span className='text-xs text-default-500'>Payment Method:</span>
            <p className='text-sm font-medium capitalize'>
              {paymentMethod.replace('-', ' ')}
            </p>
          </div>
        )}

        {hasPaymentMetadata && (
          <>
            <Divider />
            <div className='space-y-2 text-sm'>
              {paidAt && (
                <div className='flex justify-between gap-2'>
                  <span className='text-default-500'>Paid At</span>
                  <span className='text-right'>{formatDateTime(paidAt)}</span>
                </div>
              )}
              {paymentConfirmationSentAt && (
                <div className='flex justify-between gap-2'>
                  <span className='text-default-500'>Confirmation Sent</span>
                  <span className='text-right'>
                    {formatDateTime(paymentConfirmationSentAt)}
                  </span>
                </div>
              )}
              {stripeSessionId && (
                <div className='flex justify-between gap-2'>
                  <span className='text-default-500'>Stripe Session</span>
                  <span
                    className='text-right font-mono text-xs truncate max-w-44'
                    title={stripeSessionId}
                  >
                    {stripeSessionId}
                  </span>
                </div>
              )}
              {stripePaymentIntentId && (
                <div className='flex justify-between gap-2'>
                  <span className='text-default-500'>Payment Intent</span>
                  <span
                    className='text-right font-mono text-xs truncate max-w-44'
                    title={stripePaymentIntentId}
                  >
                    {stripePaymentIntentId}
                  </span>
                </div>
              )}
            </div>
          </>
        )}

        {hasRefundMetadata && (
          <>
            <Divider />
            <div className='space-y-2 text-sm'>
              <div className='flex justify-between gap-2'>
                <span className='text-default-500'>Refund Status</span>
                <span className='capitalize'>{refundStatus}</span>
              </div>
              {refundAmount !== undefined && (
                <div className='flex justify-between gap-2'>
                  <span className='text-default-500'>Refund Amount</span>
                  <span>{formatCurrency(refundAmount)}</span>
                </div>
              )}
              {refundedAt && (
                <div className='flex justify-between gap-2'>
                  <span className='text-default-500'>Refunded At</span>
                  <span className='text-right'>
                    {formatDateTime(refundedAt)}
                  </span>
                </div>
              )}
            </div>
          </>
        )}
      </CardBody>
    </Card>
  );
}
