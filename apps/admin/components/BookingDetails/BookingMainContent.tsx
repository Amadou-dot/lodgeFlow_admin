import type { PopulatedBooking } from '@/types';
import BookingStatusDates from './BookingStatusDates';
import CabinInformationCard from './CabinInformationCard';
import ExtrasCard from './ExtrasCard';
import GuestInformationCard from './GuestInformationCard';
import NotesCard from './NotesCard';

interface BookingMainContentProps {
  booking: PopulatedBooking;
  dateRange: string;
  timeInfo: string;
}

export default function BookingMainContent({
  booking,
  dateRange,
  timeInfo,
}: BookingMainContentProps) {
  return (
    <div className='lg:col-span-2 space-y-6'>
      <BookingStatusDates
        status={booking.status}
        isPaid={booking.isPaid}
        depositPaid={booking.depositPaid}
        checkInDate={booking.checkInDate.toString()}
        checkOutDate={booking.checkOutDate.toString()}
        numNights={booking.numNights}
        checkInTime={booking.checkInTime?.toString()}
        checkOutTime={booking.checkOutTime?.toString()}
        cancelledAt={booking.cancelledAt?.toString()}
        dateRange={dateRange}
        timeInfo={timeInfo}
      />

      <GuestInformationCard
        customer={booking.customer}
        numGuests={booking.numGuests}
        numNights={booking.numNights}
      />

      <CabinInformationCard
        cabin={booking.cabin}
        cabinPrice={booking.cabinPrice}
      />

      <ExtrasCard extras={booking.extras} />

      <NotesCard
        observations={booking.observations}
        specialRequests={booking.specialRequests}
        cancellationReason={booking.cancellationReason}
      />
    </div>
  );
}
