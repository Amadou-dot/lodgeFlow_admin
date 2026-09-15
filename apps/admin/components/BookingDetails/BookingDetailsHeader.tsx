import DeletionModal from '@/components/DeletionModal';
import { ArrowLeftIcon, EditIcon, TrashIcon } from '@/components/icons';
import type { PopulatedBooking } from '@/types';
import { Button } from '@heroui/button';
import { UseMutationResult } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';

interface BookingDetailsHeaderProps {
  booking: PopulatedBooking;
  onBack: () => void;
  onBookingUpdated: () => void;
  onDeleteSuccess: () => void;
  deleteMutation: UseMutationResult<void, Error, string, unknown>;
  isCancelable: boolean;
}

export default function BookingDetailsHeader({
  booking,
  onBack,
  onDeleteSuccess,
  deleteMutation,
  isCancelable,
}: BookingDetailsHeaderProps) {
  const router = useRouter();

  const handleEditBooking = () => {
    router.push(`/bookings/${booking._id}/edit`);
  };

  return (
    <div className='flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6'>
      <div className='flex items-center gap-4'>
        <Button isIconOnly variant='flat' onPress={onBack} aria-label='Go back'>
          <ArrowLeftIcon className='w-4 h-4' />
        </Button>
        <div>
          <h1 className='text-2xl font-bold'>Booking Details</h1>
          <p className='text-default-500'>
            Booking ID: {booking._id.toString()}
          </p>
        </div>
      </div>
      <div className='flex flex-col sm:flex-row gap-2 w-full sm:w-auto'>
        {isCancelable && (
          <Button
            color='primary'
            variant='flat'
            startContent={<EditIcon className='w-4 h-4' />}
            onPress={handleEditBooking}
            className='w-full sm:w-auto'
          >
            Edit Booking
          </Button>
        )}
        <DeletionModal
          resourceId={booking._id.toString()}
          resourceName={`booking for ${booking.customer?.name || 'Unknown Guest'}`}
          onDelete={deleteMutation}
          onResourceDeleted={onDeleteSuccess}
          itemName='booking'
          buttonProps={{
            color: 'danger',
            variant: 'flat',
            startContent: <TrashIcon className='w-4 h-4' />,
            className: 'w-full sm:w-auto',
          }}
        />
      </div>
    </div>
  );
}
