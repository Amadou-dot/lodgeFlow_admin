import { z } from 'zod';
import {
  diningJsonSchema,
  experienceJsonSchema,
} from '@lodgeflow/database/catalog-json-schema';
import {
  objectId,
  receipt,
  checkout,
  stripeRefund,
  dining,
  experience,
  diningStatus,
  experienceStatus,
} from '@lodgeflow/database/reservation-read-fields';
const positiveCents = z.int().positive();
const summarizedAmount = { amountCents: positiveCents };
const detailPayments = {
  receipts: z.array(receipt.extend(summarizedAmount)).nullish(),
  checkout: checkout.extend(summarizedAmount).nullish(),
  stripeRefund: stripeRefund.extend(summarizedAmount).nullish(),
};
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
type Resource = { kind: ReservationKind; reservationId: string };
export type ReservationTransaction = Pick<
  z.infer<typeof receipt>,
  'id' | 'type' | 'method' | 'amountCents'
> & { reference: string };

export class ReservationRequestRejected extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
    Object.setPrototypeOf(this, ReservationRequestRejected.prototype);
  }
}

function matchesReservation(row: { _id: string; id?: string }, id: string) {
  return (
    row._id.toLowerCase() === id.toLowerCase() &&
    (row.id === undefined || row.id.toLowerCase() === row._id.toLowerCase())
  );
}

const success = z.object({
  success: z.literal(true),
  data: z.unknown(),
  message: z.string().optional(),
  error: z.never().optional(),
});
const failure = z.object({
  error: z.string().min(1),
  success: z.unknown().optional(),
});
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
    // These route responses explicitly reject the request. Transport failures
    // and server errors can follow a committed write.
    if (
      result.success &&
      result.data.success === false &&
      [400, 401, 403, 404, 409].includes(response.status)
    )
      throw new ReservationRequestRejected(result.data.error, response.status);
    throw new Error(result.success ? result.data.error : fallback);
  }
  const envelope = success.safeParse(body);
  if (!envelope.success || !isData(envelope.data.data, schema))
    throw new Error(fallback);
  // Preserve the complete transport object, including additional nested JSON.
  return envelope.data.data;
}

export async function readReservationDetail(
  response: Response,
  { kind, reservationId }: Resource
) {
  const fallback = 'Unable to load reservation';
  const data = await read<ReservationData>(response, details[kind], fallback);
  if (!matchesReservation(data.reservation, reservationId))
    throw new Error(fallback);
  return data;
}
export async function readReservationStatus(
  response: Response,
  { kind, reservationId, status }: Resource & { status: string }
) {
  const fallback = 'Unable to update status';
  const row = await read<WriteResult>(response, writes[kind], fallback);
  if (!matchesReservation(row, reservationId) || row.status !== status)
    throw new Error(fallback);
  return row;
}
export function receiptConfirmation(
  receipts: WriteResult['receipts'],
  transaction: ReservationTransaction
) {
  const saved = receipts?.find(row => row.id === transaction.id);
  if (!saved) return 'missing';
  return saved.type === transaction.type &&
    saved.method === transaction.method &&
    saved.amountCents === transaction.amountCents &&
    saved.reference === transaction.reference.trim()
    ? 'confirmed'
    : 'conflict';
}

export async function readReservationPayment(
  response: Response,
  {
    kind,
    reservationId,
    transaction,
  }: Resource & { transaction: ReservationTransaction }
) {
  const fallback = 'Unable to record transaction';
  // The provider acknowledgement only attests a status for this HTTP request.
  if (transaction.method === 'stripe') {
    if (transaction.type !== 'refund') throw new Error(fallback);
    return read(response, refund, fallback);
  }
  const row = await read<WriteResult>(response, writes[kind], fallback);
  if (
    !matchesReservation(row, reservationId) ||
    receiptConfirmation(row.receipts, transaction) !== 'confirmed'
  )
    throw new Error(fallback);
  return row;
}
