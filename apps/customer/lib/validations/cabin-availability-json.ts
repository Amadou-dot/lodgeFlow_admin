import { cabinIdSchema } from '@/lib/validations/cabin';
import { z } from 'zod';

// The route emits UTC calendar dates, including signed years supported by Date.
const calendarDay = z.string().refine(value => {
  const date = new Date(value);
  return (
    Number.isFinite(date.getTime()) &&
    date.toISOString().split('T')[0] === value
  );
});

const dateRange = z
  .looseObject({ start: calendarDay, end: calendarDay })
  // Different instants on the same UTC day can serialize to equal bounds.
  .refine(range => Date.parse(range.start) <= Date.parse(range.end), {
    path: ['end'],
  });

const cabinAvailabilityResponse = z.looseObject({
  success: z.literal(true),
  data: z.looseObject({
    cabinId: cabinIdSchema,
    unavailableDates: z.array(dateRange),
    queryRange: dateRange,
  }),
});
const availabilityError = z.object({
  success: z.literal(false).optional(),
  error: z.string().min(1),
});

type CabinAvailabilityResponse = z.infer<typeof cabinAvailabilityResponse>;
export type CabinAvailabilityRange = z.infer<typeof dateRange>;

export async function fetchCabinAvailability(
  cabinId: string
): Promise<CabinAvailabilityResponse> {
  const response = await fetch(`/api/cabins/${cabinId}/availability`);
  if (!response.ok)
    throw new Error(`Failed to fetch availability (HTTP ${response.status})`);

  const body: unknown = await response.json().catch(() => undefined);
  const result = cabinAvailabilityResponse.safeParse(body);
  if (
    result.success &&
    result.data.data.cabinId.toLowerCase() === cabinId.toLowerCase()
  ) {
    return result.data;
  }

  const failure = availabilityError.safeParse(body);
  throw new Error(
    failure.success ? failure.data.error : 'Failed to fetch availability'
  );
}

export function isCabinDateUnavailable({
  utcDay,
  ranges,
}: {
  utcDay: number;
  ranges: readonly CabinAvailabilityRange[];
}): boolean {
  return ranges.some(
    ({ start, end }) => utcDay >= Date.parse(start) && utcDay < Date.parse(end)
  );
}
