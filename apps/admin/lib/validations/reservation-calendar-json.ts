import {
  BOOKING_STATUSES,
  CABIN_STATUSES,
  DINING_RESERVATION_STATUSES,
  EXPERIENCE_BOOKING_STATUSES,
} from '@lodgeflow/database/config';
import { z } from 'zod';
import {
  LIFECYCLES,
  RESERVATION_TYPES,
  reservationLifecycle,
} from '@/lib/reservation-options';
import type { CalendarJson, CalendarKind } from '@/types/reservation-calendar';

const objectId = z.string().regex(/^[a-f0-9]{24}$/i);
// Date.toISOString() can emit signed six-digit years.
const timestamp = z.string().refine(value => {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) && date.toISOString() === value;
});
const bookingStatus = z.enum(BOOKING_STATUSES);
const diningStatus = z.enum(DINING_RESERVATION_STATUSES);
const experienceStatus = z.enum(EXPERIENCE_BOOKING_STATUSES);
const rowStatus = z.union([bookingStatus, diningStatus, experienceStatus]);
const rowLifecycle = z.enum([...LIFECYCLES, 'seated']);
const statusesByType = {
  cabin: bookingStatus,
  dining: diningStatus,
  experience: experienceStatus,
};

export const reservationRowSchema = z
  .object({
    _id: objectId,
    type: z.enum(RESERVATION_TYPES),
    date: timestamp,
    endDate: timestamp.nullable(),
    time: z.string().nullish(),
    partySize: z.number(),
    resourceId: objectId,
    resourceName: z.string(),
    customer: z.string().min(1),
    customerName: z.string(),
    status: rowStatus.nullish(),
    lifecycle: rowLifecycle.nullish(),
    totalPrice: z.number(),
    isPaid: z.boolean().nullish(),
    createdAt: timestamp,
  })
  .superRefine((row, context) => {
    if (
      row.status != null &&
      !statusesByType[row.type].safeParse(row.status).success
    )
      context.addIssue({
        code: 'custom',
        path: ['status'],
        message: 'Invalid status for reservation type',
      });
    const lifecycle =
      row.status == null ? row.status : reservationLifecycle(row.status);
    if (row.lifecycle !== lifecycle)
      context.addIssue({
        code: 'custom',
        path: ['lifecycle'],
        message: 'Invalid lifecycle for reservation status',
      });
    if (row.type !== 'cabin' && row.endDate !== null)
      context.addIssue({
        code: 'custom',
        path: ['endDate'],
        message: 'Invalid end date for reservation type',
      });
    if (
      (row.type === 'cabin' && row.time !== null) ||
      (row.type === 'experience' && row.time === undefined)
    )
      context.addIssue({
        code: 'custom',
        path: ['time'],
        message: 'Invalid time for reservation type',
      });
  });

export const reservationInboxJsonSchema = z.object({
  rows: z.array(reservationRowSchema),
  total: z.int().nonnegative(),
  page: z.int().positive(),
  limit: z.int().positive(),
});

const calendarRange = { start: timestamp, end: timestamp };
const orderedRange = ({ start, end }: { start: string; end: string }) =>
  Date.parse(start) < Date.parse(end);
const listing = z.object({
  _id: objectId,
  name: z.string(),
});
export const cabinResourceSchema = listing.extend({
  status: z.enum(CABIN_STATUSES).nullish(),
});
export const diningResourceSchema = listing.extend({
  isAvailable: z.boolean().nullish(),
  maxPeople: z.number().nullish(),
  servingTime: z
    .object({ start: z.string().nullish(), end: z.string().nullish() })
    .nullish(),
});
export const experienceResourceSchema = listing.extend({
  maxParticipants: z.number().nullish(),
});
export const calendarStaySchema = z.object({
  _id: objectId,
  cabin: objectId,
  customer: z.string().min(1),
  checkInDate: timestamp,
  checkOutDate: timestamp,
  status: bookingStatus.nullish(),
});
const usageKey = z.object({ resourceId: objectId, date: z.iso.date() });
const experienceUsage = z.object({ _id: usageKey, used: z.number() });
export const diningUsageSchema = experienceUsage.extend({
  _id: usageKey.extend({ time: z.string().nullish() }),
});

export const calendarJsonSchemas = {
  cabins: z
    .object({
      ...calendarRange,
      resources: z.array(cabinResourceSchema),
      reservations: z.array(calendarStaySchema),
    })
    .refine(orderedRange),
  dining: z
    .object({
      ...calendarRange,
      resources: z.array(diningResourceSchema),
      usage: z.array(diningUsageSchema),
    })
    .refine(orderedRange),
  experiences: z
    .object({
      ...calendarRange,
      resources: z.array(experienceResourceSchema),
      usage: z.array(experienceUsage),
    })
    .refine(orderedRange),
};

const successEnvelope = z.object({
  success: z.literal(true),
  data: z.unknown(),
  message: z.string().optional(),
  error: z.never().optional(),
});
const failureEnvelope = z.object({
  success: z.literal(false).optional(),
  error: z.string().min(1),
});

function isResponseData<T>(
  value: unknown,
  schema: z.ZodType<T, T>
): value is T {
  // Check the fields this reader knows about and retain additive JSON at every depth.
  return schema.safeParse(value).success;
}

async function readResponse<T>({
  response,
  schema,
  fallback,
}: {
  response: Response;
  schema: z.ZodType<T, T>;
  fallback: string;
}): Promise<T> {
  const body: unknown = await response.json().catch(() => undefined);
  const result = successEnvelope.safeParse(body);
  if (response.ok && result.success && isResponseData(result.data.data, schema))
    return result.data.data;
  const failure = failureEnvelope.safeParse(body);
  throw new Error(failure.success ? failure.data.error : fallback);
}

export function readReservationInboxResponse(response: Response) {
  return readResponse({
    response,
    schema: reservationInboxJsonSchema,
    fallback: 'Unable to load reservations',
  });
}

export function readCalendarResponse({
  response,
  kind,
}: {
  response: Response;
  kind: CalendarKind;
}) {
  return readResponse<CalendarJson>({
    response,
    schema: calendarJsonSchemas[kind],
    fallback: 'Unable to load calendar',
  });
}
