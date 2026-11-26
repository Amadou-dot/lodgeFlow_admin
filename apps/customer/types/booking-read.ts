export type {
  BookingPaymentStatus,
  BookingDetailCabin,
} from '@lodgeflow/database/booking-json';

import type { z } from 'zod';
import type {
  bookingHistoryItem,
  bookingDetail,
} from '@/lib/validations/booking-read-json';
// Read projections include nullable and omitted legacy fields retained by the serializers.
export type BookingHistoryItem = z.infer<typeof bookingHistoryItem>;
export type BookingDetail = z.infer<typeof bookingDetail>;
export type BookingReadFields = Omit<BookingHistoryItem, 'cabin'>;
export type BookingHistoryCabin = NonNullable<BookingHistoryItem['cabin']>;
