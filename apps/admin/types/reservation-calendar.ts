import type {
  BOOKING_STATUSES,
  CABIN_STATUSES,
  DINING_RESERVATION_STATUSES,
  EXPERIENCE_BOOKING_STATUSES,
} from '@lodgeflow/database/config';
import type { Lifecycle, ReservationType } from '@/lib/reservation-options';
export type ReservationStatus =
  | (typeof BOOKING_STATUSES)[number]
  | (typeof DINING_RESERVATION_STATUSES)[number]
  | (typeof EXPERIENCE_BOOKING_STATUSES)[number];
export interface ReservationRow {
  _id: string;
  type: ReservationType;
  date: string;
  endDate: string | null;
  time: string | null;
  partySize: number;
  resourceId: string;
  resourceName: string;
  customer: string;
  customerName: string;
  status: ReservationStatus;
  lifecycle: Lifecycle | 'seated';
  totalPrice: number;
  isPaid: boolean;
  createdAt: string;
}
export interface ReservationInboxJson {
  rows: ReservationRow[];
  total: number;
  page: number;
  limit: number;
}
export interface CalendarResource {
  _id: string;
  name: string;
  status?: (typeof CABIN_STATUSES)[number];
  isAvailable?: boolean;
  maxPeople?: number;
  maxParticipants?: number;
  servingTime?: { start: string; end: string };
}
export interface CalendarStay {
  _id: string;
  cabin: string;
  customer: string;
  checkInDate: string;
  checkOutDate: string;
  status: (typeof BOOKING_STATUSES)[number];
}
export interface CalendarUsage {
  _id: { resourceId: string; date: string; time?: string };
  used: number;
}
export interface CabinCalendarJson {
  resources: CalendarResource[];
  reservations: CalendarStay[];
}
export interface CapacityCalendarJson {
  resources: CalendarResource[];
  usage: CalendarUsage[];
}
export type CalendarJson = { start: string; end: string } & (
  | (CabinCalendarJson & { usage?: never })
  | (CapacityCalendarJson & { reservations?: never })
);
