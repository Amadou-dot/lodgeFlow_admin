import type {
  bookingStatsJsonSchema,
  cabinStatsJsonSchema,
  diningStatsJsonSchema,
  experienceStatsJsonSchema,
} from '@/lib/validations/reporting-json';
import type { z } from 'zod';

export type CabinStats = z.output<typeof cabinStatsJsonSchema>;
export type DiningStats = z.output<typeof diningStatsJsonSchema>;
export type ExperienceStats = z.output<typeof experienceStatsJsonSchema>;
export type BookingStats = z.output<typeof bookingStatsJsonSchema>;
