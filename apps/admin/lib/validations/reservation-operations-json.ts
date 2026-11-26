import {
  DINING_RESERVATION_STATUSES,
  EXPERIENCE_BOOKING_STATUSES,
  TABLE_PREFERENCES,
} from '@lodgeflow/database/config';
import { z } from 'zod';
import { diningJsonSchema, experienceJsonSchema } from './catalog-json';
import { jsonTimestampSchema as timestamp } from './customer-json';

const objectId = z.string().regex(/^[a-f0-9]{24}$/i);
const textList = z.array(z.string().nullable()).nullish();
const positiveCents = z.int().positive();
const receipt = z.object({
  id: z.string().min(1),
  type: z.enum(['payment', 'refund']),
  amountCents: z.number(),
  method: z.enum(['cash', 'bank_transfer', 'card', 'stripe']),
  reference: z.string().nullish(),
  actor: z.string().min(1),
  recordedAt: timestamp,
});
// Status changes and idempotent receipt acknowledgements can serialize stored
// records before any balance calculation. Detail GET also computes a summary.
const checkout = z.object({
  token: z.string().nullish(),
  amountCents: z.number().nullish(),
  currency: z.string().nullish(),
  createdAt: timestamp.nullish(),
  sessionId: z.string().nullish(),
  pending: z.boolean().nullish(),
});
const stripeRefund = z.object({
  token: z.string().nullish(),
  amountCents: z.number().nullish(),
  createdAt: timestamp.nullish(),
  refundId: z.string().nullish(),
  status: z.enum(['pending', 'succeeded', 'failed']).nullish(),
  actor: z.string().nullish(),
  reference: z.string().nullish(),
});
const summarizedAmount = { amountCents: positiveCents };
const detailPayments = {
  receipts: z.array(receipt.extend(summarizedAmount)).nullish(),
  checkout: checkout.extend(summarizedAmount).nullish(),
  stripeRefund: stripeRefund.extend(summarizedAmount).nullish(),
};
const common = z.object({
  _id: objectId,
  id: objectId.optional(),
  __v: z.number().nullish(),
  customer: z.string().min(1),
  date: timestamp,
  createdAt: timestamp.nullish(),
  updatedAt: timestamp.nullish(),
  totalPrice: z.number(),
  isPaid: z.boolean().nullable(),
  stripePaymentIntentId: z.string().nullish(),
  specialRequests: textList,
  receipts: z.array(receipt).nullish(),
  paymentConfirmationSentAt: timestamp.nullish(),
  checkout: checkout.nullish(),
  stripeRefund: stripeRefund.nullish(),
});
const diningStatus = z.enum(DINING_RESERVATION_STATUSES);
const experienceStatus = z.enum(EXPERIENCE_BOOKING_STATUSES);
const dining = common.extend({
  time: z.string(),
  numGuests: z.number(),
  status: diningStatus.nullable(),
  dietaryRequirements: textList,
  tablePreference: z.enum(TABLE_PREFERENCES).nullish(),
  occasion: z.string().nullish(),
});
const experience = common.extend({
  timeSlot: z.string().nullish(),
  numParticipants: z.number(),
  status: experienceStatus.nullable(),
  observations: z.string().nullish(),
});

const payment = z.object({
  totalCents: z.int().nonnegative(),
  paidCents: z.int().nonnegative(),
  refundedCents: z.int().nonnegative(),
  balanceCents: z.int().nonnegative(),
  refundableCents: z.int().nonnegative(),
  legacyPaid: z.boolean().nullable(),
});
const detail = z.object({
  customerName: z.string(),
  currency: z.string().nullable(),
  payment,
});
const details = {
  dining: detail.extend({
    allowedStatuses: z.array(diningStatus),
    reservation: dining.extend({
      ...detailPayments,
      dining: diningJsonSchema.nullable(),
    }),
  }),
  experience: detail.extend({
    allowedStatuses: z.array(experienceStatus),
    reservation: experience.extend({
      ...detailPayments,
      experience: experienceJsonSchema.nullable(),
    }),
  }),
};
const writes = {
  dining: dining.extend({ dining: objectId }),
  experience: experience.extend({ experience: objectId }),
};
const reservationWrite = z.union([writes.dining, writes.experience]);
// A complete reservation also has a string status. It acknowledges a manual write.
const refund = z
  .looseObject({ status: z.string().nullable() })
  .refine(value => !reservationWrite.safeParse(value).success);

export type ReservationKind = keyof typeof details;
export type ReservationData = z.infer<(typeof details)[ReservationKind]>;
export type PaymentSummary = z.infer<typeof payment>;
export type ReservationPaymentFields = Pick<
  ReservationData['reservation'],
  'receipts' | 'checkout' | 'stripeRefund'
>;
type WriteResult = z.infer<typeof reservationWrite>;

const success = z.object({
  success: z.literal(true),
  data: z.unknown(),
  message: z.string().optional(),
  error: z.never().optional(),
});
const failure = z.object({ error: z.string().min(1) });
function isData<T>(data: unknown, schema: z.ZodType<T, T>): data is T {
  return schema.safeParse(data).success;
}
async function read<T>(
  response: Response,
  schema: z.ZodType<T, T>,
  fallback: string
): Promise<T> {
  const body: unknown = await response.json().catch(() => undefined);
  if (!response.ok) {
    const result = failure.safeParse(body);
    throw new Error(result.success ? result.data.error : fallback);
  }
  const envelope = success.safeParse(body);
  if (!envelope.success || !isData(envelope.data.data, schema))
    throw new Error(fallback);
  // Preserve the complete transport object, including additional nested JSON.
  return envelope.data.data;
}

export function readReservationDetail(
  response: Response,
  kind: ReservationKind
) {
  return read<ReservationData>(
    response,
    details[kind],
    'Unable to load reservation'
  );
}
export function readReservationStatus(
  response: Response,
  kind: ReservationKind
) {
  return read<WriteResult>(response, writes[kind], 'Unable to update status');
}
export function readReservationPayment(
  response: Response,
  operation: {
    kind: ReservationKind;
    method: z.infer<typeof receipt>['method'];
  }
) {
  return operation.method === 'stripe'
    ? read(response, refund, 'Unable to record transaction')
    : read<WriteResult>(
        response,
        writes[operation.kind],
        'Unable to record transaction'
      );
}
