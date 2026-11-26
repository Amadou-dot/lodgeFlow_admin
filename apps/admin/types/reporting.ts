import type {
  bookingAnalyticsJsonSchema,
  dashboardJsonSchema,
  salesRowJsonSchema,
} from '@/lib/validations/reporting-json';
import type { analyticsPeriodSchema } from '@/lib/validations/reporting';
import type { z } from 'zod';

export type AnalyticsPeriod = z.output<typeof analyticsPeriodSchema>;
export type DashboardData = z.output<typeof dashboardJsonSchema>;
export type SalesData = z.output<typeof salesRowJsonSchema>;
export type BookingAnalyticsData = z.output<typeof bookingAnalyticsJsonSchema>;
