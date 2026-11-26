import { MoneyError } from '@lodgeflow/database/money';
import { formatCurrency } from './utilityFunctions';
import { formatBookingStayDate } from '@/lib/booking-stay-date';
import type { AdminBooking } from '@/types/booking-read';
import { formatDistanceToNow, isAfter } from 'date-fns';

export const formatBookingDates = ({
  checkIn,
  checkOut,
  numNights,
  status,
}: {
  checkIn: string;
  checkOut: string;
  numNights: number;
  status: AdminBooking['status'];
}) => {
  const checkInDate = new Date(checkIn);
  const checkOutDate = new Date(checkOut);
  const now = new Date();

  const checkInLabel = formatBookingStayDate({
    date: checkIn,
    style: 'short-padded',
  });
  const checkOutLabel = formatBookingStayDate({
    date: checkOut,
    style: 'short-padded',
  });
  const dateRange = `${checkInLabel} — ${checkOutLabel}`;

  let timeInfo = '';
  let showTimeInfo = true;

  switch (status) {
    case 'checked-in':
      // Currently staying - show how long ago they checked in
      timeInfo = `${formatDistanceToNow(checkInDate, { addSuffix: true })} → ${numNights} night${numNights !== 1 ? 's' : ''} stay`;
      break;

    case 'checked-out':
      // Past stay - show how long ago they checked out
      timeInfo = `${formatDistanceToNow(checkOutDate, { addSuffix: true })} → ${numNights} night${numNights !== 1 ? 's' : ''} stay`;
      break;

    case 'confirmed':
    case 'unconfirmed':
      // Future booking - show time until check-in
      if (isAfter(checkInDate, now)) {
        timeInfo = `${formatDistanceToNow(checkInDate)} → ${numNights} night${numNights !== 1 ? 's' : ''} stay`;
      } else {
        // Overdue check-in
        timeInfo = `${formatDistanceToNow(checkInDate, { addSuffix: true })} → ${numNights} night${numNights !== 1 ? 's' : ''} stay`;
      }
      break;

    case 'cancelled':
      // Cancelled - no time info, just gray out
      showTimeInfo = false;
      break;
  }

  return {
    dateRange,
    timeInfo,
    showTimeInfo,
  };
};

// HeroUI Chip color type
export type ChipColor =
  'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'danger';

export const getStatusColor = (
  status: string | null | undefined
): ChipColor => {
  switch (status) {
    case 'unconfirmed':
      return 'warning';
    case 'confirmed':
      return 'primary';
    case 'checked-in':
      return 'success';
    case 'checked-out':
      return 'default';
    case 'cancelled':
      return 'danger';
    default:
      return 'default';
  }
};

export const getStatusLabel = (status: string | null | undefined) => {
  switch (status) {
    case 'unconfirmed':
      return 'Unconfirmed';
    case 'confirmed':
      return 'Confirmed';
    case 'checked-in':
      return 'Checked In';
    case 'checked-out':
      return 'Checked Out';
    case 'cancelled':
      return 'Cancelled';
    default:
      return status ?? 'Unavailable';
  }
};

export function formatBookingAmount(amount: number | null | undefined) {
  if (amount == null) return 'Unavailable';
  try {
    return formatCurrency(amount);
  } catch (error) {
    if (error instanceof MoneyError) return 'Unavailable';
    throw error;
  }
}
