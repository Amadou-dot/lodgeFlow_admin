import { format, formatDistanceToNow, isAfter } from 'date-fns';

export const formatBookingDates = (
  checkIn: string,
  checkOut: string,
  numNights: number,
  status:
    | 'unconfirmed'
    | 'confirmed'
    | 'checked-in'
    | 'checked-out'
    | 'cancelled'
) => {
  const checkInDate = new Date(checkIn);
  const checkOutDate = new Date(checkOut);
  const now = new Date();

  // Format the date range
  const dateRange = `${format(checkInDate, 'MMM dd, yyyy')} — ${format(checkOutDate, 'MMM dd, yyyy')}`;

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
  | 'default'
  | 'primary'
  | 'secondary'
  | 'success'
  | 'warning'
  | 'danger';

export const getStatusColor = (status: string): ChipColor => {
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

export const getStatusLabel = (status: string) => {
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
      return status;
  }
};
