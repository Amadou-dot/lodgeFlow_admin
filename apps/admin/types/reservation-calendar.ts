import type {
  cabinResourceSchema,
  calendarJsonSchemas,
  calendarStaySchema,
  diningResourceSchema,
  diningUsageSchema,
  experienceResourceSchema,
  reservationInboxJsonSchema,
  reservationRowSchema,
} from '@/lib/validations/reservation-calendar-json';
import type { z } from 'zod';

export type ReservationRow = z.infer<typeof reservationRowSchema>;
export type ReservationInboxJson = z.infer<typeof reservationInboxJsonSchema>;

export type CalendarResource = z.infer<typeof cabinResourceSchema> &
  Omit<z.infer<typeof diningResourceSchema>, '_id' | 'name'> &
  Omit<z.infer<typeof experienceResourceSchema>, '_id' | 'name'>;
export type CalendarStay = z.infer<typeof calendarStaySchema>;
export type CalendarUsage = z.infer<typeof diningUsageSchema>;

type CalendarSchemas = typeof calendarJsonSchemas;
export type CalendarKind = keyof CalendarSchemas;
export type CabinCalendarJson = z.infer<CalendarSchemas['cabins']>;
export type DiningCalendarJson = z.infer<CalendarSchemas['dining']>;
export type ExperienceCalendarJson = z.infer<CalendarSchemas['experiences']>;
export type CalendarJson =
  | (CabinCalendarJson & { usage?: never })
  | ((DiningCalendarJson | ExperienceCalendarJson) & { reservations?: never });
