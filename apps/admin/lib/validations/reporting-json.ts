import { z } from 'zod';

const timestamp = z.iso.datetime();

export const dashboardJsonSchema = z.object({
  overview: z.object({
    totalBookings: z.number(),
    totalRevenue: z.number(),
    totalCabins: z.number(),
    totalCustomers: z.number(),
    totalCancellations: z.number().nullish(),
    // A zero stored capacity can yield a nonfinite ratio, serialized as null.
    occupancyRate: z.number().nullable(),
    checkInsToday: z.number(),
    checkOutsToday: z.number(),
  }),
  recentActivity: z.array(
    z.object({
      id: z.string(),
      customerName: z.string(),
      cabinName: z.string(),
      checkInDate: timestamp,
      checkOutDate: timestamp,
      totalPrice: z.number().nullish(),
      status: z.string().nullable(),
      createdAt: timestamp,
    })
  ),
  charts: z.object({
    occupancy: z.array(
      z.object({
        date: z.iso.date(),
        occupancyRate: z.number(),
        totalGuests: z.number(),
        totalCapacity: z.number(),
      })
    ),
    revenue: z.array(
      z.object({
        week: z.string(),
        revenue: z.number(),
        bookings: z.number(),
      })
    ),
    durations: z
      .array(
        z.object({
          name: z.string(),
          value: z.number(),
          color: z.string(),
        })
      )
      .nullish(),
  }),
});

export const salesRowJsonSchema = z.object({
  date: z.string(),
  fullDate: z.iso.date(),
  sales: z.number(),
  bookings: z.number(),
});

export const salesJsonSchema = z.array(salesRowJsonSchema);

const extrasStatJsonSchema = z.object({ count: z.number(), rate: z.number() });

export const bookingAnalyticsJsonSchema = z.object({
  summary: z.object({
    totalRevenue: z.number(),
    totalBookings: z.number(),
    avgBookingValue: z.number(),
    cancellationRate: z.number(),
  }),
  // All-time buckets can include records without a date or status.
  revenueOverTime: z.array(
    z.object({
      date: z.string().nullable(),
      revenue: z.number(),
      bookings: z.number(),
    })
  ),
  statusDistribution: z.array(
    z.object({
      status: z.string().nullable(),
      count: z.number(),
    })
  ),
  popularCabins: z.array(
    z.object({
      name: z.string().nullish(),
      bookingCount: z.number(),
      revenue: z.number(),
    })
  ),
  demographics: z.object({
    avgPartySize: z.number(),
    avgStayLength: z.number(),
    extras: z.object({
      breakfast: extrasStatJsonSchema,
      pets: extrasStatJsonSchema,
      parking: extrasStatJsonSchema,
      earlyCheckIn: extrasStatJsonSchema,
      lateCheckOut: extrasStatJsonSchema,
    }),
  }),
});

export const bookingStatsJsonSchema = z.object({
  todayCheckIns: z.number(),
  todayCheckOuts: z.number(),
  checkedIn: z.number(),
  unconfirmed: z.number(),
});

// Read aggregates may include finite values outside today's write limits.
export const cabinStatsJsonSchema = z.object({
  totalCabins: z.number(),
  totalCapacity: z.number(),
  averagePrice: z.number().nullable(),
  cabinsWithDiscount: z.number(),
  activeCabins: z.number(),
  inactiveCabins: z.number(),
  maintenanceCabins: z.number(),
});

export const diningStatsJsonSchema = z.object({
  totalItems: z.number(),
  menuCount: z.number(),
  experienceCount: z.number(),
  averagePrice: z.number().nullable(),
  availableItems: z.number(),
});

export const experienceStatsJsonSchema = z.object({
  totalExperiences: z.number(),
  averagePrice: z.number().nullable(),
  popularCount: z.number(),
  totalCapacity: z.number(),
});

const reportSuccessSchema = z.object({
  success: z.literal(true),
  data: z.unknown(),
});
const reportErrorSchema = z.object({
  success: z.literal(false),
  error: z.string(),
});

function isReportJson<Report>(
  value: unknown,
  schema: z.ZodType<Report, Report>
): value is Report {
  // Validate against the known fields and keep the original additive JSON.
  return schema.safeParse(value).success;
}

export function parseReportJson<Report>({
  value,
  schema,
  format,
  errorMessage,
  useWrappedError,
}: {
  value: unknown;
  schema: z.ZodType<Report, Report>;
  format: 'wrapped' | 'bare' | 'wrapped-or-bare';
  errorMessage: string;
  useWrappedError?: boolean;
}): Report {
  const hasSuccessMarker =
    typeof value === 'object' && value !== null && 'success' in value;
  if (
    format === 'wrapped' ||
    (format === 'wrapped-or-bare' && hasSuccessMarker)
  ) {
    const envelope = reportSuccessSchema.safeParse(value);
    if (!envelope.success) {
      const failure = reportErrorSchema.safeParse(value);
      throw new Error(
        (useWrappedError && failure.success && failure.data.error) ||
          errorMessage
      );
    }
    value = envelope.data.data;
  }
  if (!isReportJson(value, schema)) throw new Error(errorMessage);
  return value;
}
