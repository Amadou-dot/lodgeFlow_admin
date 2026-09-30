import type { BookingStatus } from '@/lib/config';

export interface BookingStatusChange {
  bookingId: string;
  status: BookingStatus;
}

export type BookingStatusChangeHandler = (change: BookingStatusChange) => void;
