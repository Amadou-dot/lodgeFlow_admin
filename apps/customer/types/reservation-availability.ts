import type { diningDayAvailabilitySchema } from '@/lib/validations/reservation-availability';
import type { z } from 'zod';

export type DiningDayAvailability = z.infer<typeof diningDayAvailabilitySchema>;
export interface DiningRangeAvailability {
  diningId: string;
  fullyBookedDates: string[];
  maxPeople: number | null;
  servingTime: { start: string; end: string };
  queryRange: { start: string; end: string };
}
export interface ExperienceDayAvailability {
  experienceId: string;
  date: string;
  spotsRemaining: number | null;
  maxParticipants: number | null;
  isAvailable: boolean;
}
export interface ExperienceRangeAvailability {
  experienceId: string;
  fullyBookedDates: string[];
  maxParticipants: number | null;
  availableDays?: string[];
  queryRange: { start: string; end: string };
}
