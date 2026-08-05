'use client';

import { useState } from 'react';
import { Button } from '@heroui/button';
import { Card, CardBody, CardHeader } from '@heroui/card';
import { Chip } from '@heroui/chip';
import { DatePicker } from '@heroui/date-picker';
import { Input } from '@heroui/input';
import {
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  useDisclosure,
} from '@heroui/modal';
import { Select, SelectItem } from '@heroui/select';
import { Spinner } from '@heroui/spinner';
import { Tab, Tabs } from '@heroui/tabs';
import { addToast } from '@heroui/toast';
import { Calendar, Clock, DollarSign, Users } from 'lucide-react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';

import PaymentButton from '@/components/PaymentButton';
import { title, subtitle } from '@/components/primitives';
import {
  useBookingHistory,
  useCancelBooking,
  useUpdateBooking,
} from '@/hooks/useBooking';
import {
  useCancelDiningReservation,
  useDiningReservationHistory,
} from '@/hooks/useDiningReservation';
import {
  useCancelExperienceBooking,
  useExperienceBookingHistory,
} from '@/hooks/useExperienceBooking';
import type { Booking, ExperienceBooking } from '@/types';

const statusFilters = [
  { key: 'all', label: 'All Bookings' },
  { key: 'unconfirmed', label: 'Unconfirmed' },
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'checked-in', label: 'Checked In' },
  { key: 'checked-out', label: 'Checked Out' },
  { key: 'cancelled', label: 'Cancelled' },
];

const statusColorMap: Record<
  string,
  'default' | 'primary' | 'success' | 'warning' | 'danger'
> = {
  unconfirmed: 'warning',
  confirmed: 'primary',
  'checked-in': 'success',
  'checked-out': 'default',
  cancelled: 'danger',
  pending: 'warning',
  completed: 'default',
  'no-show': 'danger',
};

const experienceStatusFilters = [
  { key: 'all', label: 'All Bookings' },
  { key: 'pending', label: 'Pending' },
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'completed', label: 'Completed' },
  { key: 'cancelled', label: 'Cancelled' },
];

const diningStatusFilters = [
  { key: 'all', label: 'All Reservations' },
  { key: 'pending', label: 'Pending' },
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'completed', label: 'Completed' },
  { key: 'cancelled', label: 'Cancelled' },
  { key: 'no-show', label: 'No Show' },
];

export default function BookingsPage() {
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const {
    isOpen: isDetailsOpen,
    onOpen: onDetailsOpen,
    onClose: onDetailsClose,
  } = useDisclosure();
  const {
    isOpen: isCancelOpen,
    onOpen: onCancelOpen,
    onClose: onCancelClose,
  } = useDisclosure();
  const {
    isOpen: isEditOpen,
    onOpen: onEditOpen,
    onClose: onEditClose,
  } = useDisclosure();

  // Edit form state
  const [editFormData, setEditFormData] = useState({
    checkInDate: '',
    checkOutDate: '',
    numGuests: 0,
    observations: '',
  });

  const {
    data: bookings,
    isLoading,
    error,
  } = useBookingHistory(statusFilter === 'all' ? undefined : statusFilter);

  const cancelBooking = useCancelBooking();
  const updateBooking = useUpdateBooking();

  // Experience bookings
  const [expStatusFilter, setExpStatusFilter] = useState<string>('all');
  const {
    data: experienceBookings,
    isLoading: expLoading,
    error: expError,
  } = useExperienceBookingHistory(
    expStatusFilter === 'all' ? undefined : expStatusFilter
  );
  const cancelExpBooking = useCancelExperienceBooking();

  // Dining reservations
  const [diningStatusFilter, setDiningStatusFilter] = useState<string>('all');
  const {
    data: diningReservations,
    isLoading: diningLoading,
    error: diningError,
  } = useDiningReservationHistory(
    diningStatusFilter === 'all' ? undefined : diningStatusFilter
  );
  const cancelDiningReservation = useCancelDiningReservation();

  const handleViewDetails = (booking: Booking) => {
    setSelectedBooking(booking);
    onDetailsOpen();
  };

  const handleEditBooking = (booking: Booking) => {
    setSelectedBooking(booking);
    setEditFormData({
      checkInDate: new Date(booking.checkInDate).toISOString().split('T')[0],
      checkOutDate: new Date(booking.checkOutDate).toISOString().split('T')[0],
      numGuests: booking.numGuests,
      observations: booking.observations || '',
    });
    onEditOpen();
  };

  const handleCancelBooking = (booking: Booking) => {
    setSelectedBooking(booking);
    onCancelOpen();
  };

  const confirmUpdateBooking = async () => {
    if (!selectedBooking) return;

    try {
      const updates: Partial<Booking> = {
        checkInDate: new Date(editFormData.checkInDate),
        checkOutDate: new Date(editFormData.checkOutDate),
        numGuests: editFormData.numGuests,
        observations: editFormData.observations,
      };

      await updateBooking.mutateAsync({
        bookingId: selectedBooking._id.toString(),
        updates,
      });

      addToast({
        title: 'Booking Updated',
        description: 'Your booking has been successfully updated.',
        color: 'success',
      });
      onEditClose();
      setSelectedBooking(null);
    } catch (error) {
      addToast({
        title: 'Error',
        description:
          error instanceof Error
            ? error.message
            : 'Failed to update booking. Please try again.',
        color: 'danger',
      });
    }
  };

  const confirmCancelBooking = async () => {
    if (!selectedBooking) return;

    try {
      await cancelBooking.mutateAsync({
        bookingId: selectedBooking._id.toString(),
      });
      addToast({
        title: 'Booking Cancelled',
        description: 'Your booking has been successfully cancelled.',
        color: 'success',
      });
      onCancelClose();
      setSelectedBooking(null);
    } catch (error) {
      addToast({
        title: 'Error',
        description: 'Failed to cancel booking. Please try again.',
        color: 'danger',
      });
    }
  };

  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const canCancelBooking = (booking: Booking) => {
    return booking.status === 'unconfirmed' || booking.status === 'confirmed';
  };

  const canModifyBooking = (booking: Booking) => {
    return booking.status === 'unconfirmed';
  };

  return (
    <section className='flex flex-col items-center justify-center gap-4 py-8 md:py-10 px-4'>
      <div className='w-full max-w-7xl'>
        <div className='inline-block max-w-4xl text-center justify-center mb-8'>
          <h1 className={title()}>My Bookings</h1>
          <h2 className={subtitle({ class: 'mt-4' })}>
            View and manage your reservations
          </h2>
        </div>

        <Tabs className='mb-6' color='primary' variant='underlined'>
          <Tab key='cabins' title='Cabin Bookings'>
            {/* Cabin Bookings Content */}
            {/* Filters */}
            <div className='mb-6 max-w-xs mt-4'>
              <Select
                label='Filter by Status'
                placeholder='Select status'
                selectedKeys={[statusFilter]}
                onChange={e => setStatusFilter(e.target.value)}
              >
                {statusFilters.map(filter => (
                  <SelectItem key={filter.key}>{filter.label}</SelectItem>
                ))}
              </Select>
            </div>
            {/* Loading State */}
            {isLoading && (
              <div className='flex justify-center py-12'>
                <Spinner label='Loading your bookings...' size='lg' />
              </div>
            )}{' '}
            {/* Error State */}
            {error && (
              <Card className='bg-danger-50 dark:bg-danger-900/20'>
                <CardBody>
                  <p className='text-danger'>
                    Failed to load bookings. Please try again later.
                  </p>
                </CardBody>
              </Card>
            )}
            {/* Empty State */}
            {!isLoading && !error && bookings?.length === 0 && (
              <Card>
                <CardBody className='text-center py-12'>
                  <Calendar className='w-16 h-16 mx-auto mb-4 text-default-400' />
                  <h3 className='text-xl font-semibold mb-2'>
                    No bookings found
                  </h3>
                  <p className='text-default-500 mb-6'>
                    {statusFilter === 'all'
                      ? "You haven't made any bookings yet."
                      : `No ${statusFilter} bookings found.`}
                  </p>
                  <Button
                    color='primary'
                    onPress={() => router.push('/cabins')}
                  >
                    Browse Cabins
                  </Button>
                </CardBody>
              </Card>
            )}
            {/* Bookings List */}
            {!isLoading && !error && bookings && bookings.length > 0 && (
              <div className='grid gap-6 md:grid-cols-2 lg:grid-cols-2'>
                {bookings.map((booking: any) => (
                  <Card key={booking._id.toString()} className='w-full'>
                    <CardHeader className='flex gap-3'>
                      <div className='relative w-24 h-24 shrink-0 rounded-lg overflow-hidden'>
                        <Image
                          alt={booking.cabin?.name || 'Cabin'}
                          className='object-cover'
                          fill
                          src={booking.cabin?.image || '/placeholder-cabin.jpg'}
                        />
                      </div>
                      <div className='flex flex-col flex-1'>
                        <p className='text-lg font-bold'>
                          {booking.cabin?.name}
                        </p>
                        <div className='flex items-center gap-2 mt-1 flex-wrap'>
                          <Chip
                            className='w-fit'
                            color={statusColorMap[booking.status]}
                            size='sm'
                            variant='flat'
                          >
                            {booking.status.replace('-', ' ').toUpperCase()}
                          </Chip>
                          {booking.status === 'cancelled' &&
                            booking.refundStatus &&
                            booking.refundStatus !== 'none' && (
                              <Chip
                                className='w-fit'
                                size='sm'
                                variant='flat'
                                color={
                                  (
                                    {
                                      pending: 'warning',
                                      processing: 'primary',
                                      partial: 'warning',
                                      full: 'success',
                                      failed: 'danger',
                                    } as const
                                  )[
                                    booking.refundStatus as
                                      | 'pending'
                                      | 'processing'
                                      | 'partial'
                                      | 'full'
                                      | 'failed'
                                  ] || 'default'
                                }
                              >
                                Refund:{' '}
                                {booking.refundStatus.charAt(0).toUpperCase() +
                                  booking.refundStatus.slice(1)}
                              </Chip>
                            )}
                        </div>
                        {booking.status === 'cancelled' &&
                          booking.cancelledAt && (
                            <p className='text-xs text-default-400 mt-1'>
                              Cancelled on {formatDate(booking.cancelledAt)}
                            </p>
                          )}
                      </div>
                    </CardHeader>

                    <CardBody className='pt-0'>
                      <div className='space-y-3'>
                        <div className='flex items-center gap-2 text-sm'>
                          <Calendar className='w-4 h-4 text-default-400' />
                          <span>
                            {formatDate(booking.checkInDate)} -{' '}
                            {formatDate(booking.checkOutDate)}
                          </span>
                        </div>

                        <div className='flex items-center gap-2 text-sm'>
                          <Clock className='w-4 h-4 text-default-400' />
                          <span>{booking.numNights} nights</span>
                        </div>

                        <div className='flex items-center gap-2 text-sm'>
                          <Users className='w-4 h-4 text-default-400' />
                          <span>{booking.numGuests} guests</span>
                        </div>

                        <div className='flex items-center gap-2 text-sm font-semibold'>
                          <DollarSign className='w-4 h-4 text-success' />
                          <span className='text-lg'>${booking.totalPrice}</span>
                          {booking.isPaid ? (
                            <Chip color='success' size='sm' variant='flat'>
                              Paid
                            </Chip>
                          ) : booking.depositPaid ? (
                            <Chip color='primary' size='sm' variant='flat'>
                              Deposit Paid
                            </Chip>
                          ) : null}
                        </div>

                        {!booking.isPaid &&
                          booking.status !== 'cancelled' &&
                          (() => {
                            const isDepositDue =
                              booking.depositAmount > 0 && !booking.depositPaid;
                            const remainingBalance = Math.max(
                              0,
                              booking.totalPrice -
                                (booking.depositPaid
                                  ? booking.depositAmount
                                  : 0)
                            );
                            const amountToPay = isDepositDue
                              ? booking.depositAmount
                              : remainingBalance;

                            if (amountToPay <= 0) return null;

                            return (
                              <div className='pt-2'>
                                <PaymentButton
                                  amount={amountToPay}
                                  bookingId={booking._id.toString()}
                                  isDeposit={isDepositDue}
                                  size='sm'
                                />
                              </div>
                            );
                          })()}

                        <div className='flex gap-2 pt-4'>
                          <Button
                            className='flex-1'
                            size='sm'
                            variant='flat'
                            onPress={() => handleViewDetails(booking)}
                          >
                            View Details
                          </Button>
                          {canModifyBooking(booking) && (
                            <Button
                              color='primary'
                              size='sm'
                              variant='flat'
                              onPress={() => handleEditBooking(booking)}
                            >
                              Edit
                            </Button>
                          )}
                          {canCancelBooking(booking) && (
                            <Button
                              color='danger'
                              size='sm'
                              variant='flat'
                              onPress={() => handleCancelBooking(booking)}
                            >
                              Cancel
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardBody>
                  </Card>
                ))}
              </div>
            )}
          </Tab>

          <Tab key='experiences' title='Experience Bookings'>
            {/* Experience Bookings Content */}
            <div className='mb-6 max-w-xs mt-4'>
              <Select
                label='Filter by Status'
                placeholder='Select status'
                selectedKeys={[expStatusFilter]}
                onChange={e => setExpStatusFilter(e.target.value)}
              >
                {experienceStatusFilters.map(filter => (
                  <SelectItem key={filter.key}>{filter.label}</SelectItem>
                ))}
              </Select>
            </div>

            {expLoading && (
              <div className='flex justify-center py-12'>
                <Spinner label='Loading experience bookings...' size='lg' />
              </div>
            )}

            {expError && (
              <Card className='bg-danger-50 dark:bg-danger-900/20'>
                <CardBody>
                  <p className='text-danger'>
                    Failed to load experience bookings.
                  </p>
                </CardBody>
              </Card>
            )}

            {!expLoading && !expError && experienceBookings?.length === 0 && (
              <Card>
                <CardBody className='text-center py-12'>
                  <Calendar className='w-16 h-16 mx-auto mb-4 text-default-400' />
                  <h3 className='text-xl font-semibold mb-2'>
                    No experience bookings found
                  </h3>
                  <p className='text-default-500 mb-6'>
                    {expStatusFilter === 'all'
                      ? "You haven't booked any experiences yet."
                      : `No ${expStatusFilter} experience bookings found.`}
                  </p>
                  <Button
                    color='primary'
                    onPress={() => router.push('/experiences')}
                  >
                    Browse Experiences
                  </Button>
                </CardBody>
              </Card>
            )}

            {!expLoading &&
              !expError &&
              experienceBookings &&
              experienceBookings.length > 0 && (
                <div className='grid gap-6 md:grid-cols-2 lg:grid-cols-2'>
                  {experienceBookings.map((booking: any) => (
                    <Card key={booking._id.toString()} className='w-full'>
                      <CardHeader className='flex gap-3'>
                        <div className='relative w-24 h-24 shrink-0 rounded-lg overflow-hidden'>
                          <Image
                            alt={booking.experience?.name || 'Experience'}
                            className='object-cover'
                            fill
                            src={
                              booking.experience?.image ||
                              '/placeholder-experience.jpg'
                            }
                          />
                        </div>
                        <div className='flex flex-col flex-1'>
                          <p className='text-lg font-bold'>
                            {booking.experience?.name}
                          </p>
                          <Chip
                            className='mt-1 w-fit'
                            color={statusColorMap[booking.status]}
                            size='sm'
                            variant='flat'
                          >
                            {booking.status.toUpperCase()}
                          </Chip>
                        </div>
                      </CardHeader>

                      <CardBody className='pt-0'>
                        <div className='space-y-3'>
                          <div className='flex items-center gap-2 text-sm'>
                            <Calendar className='w-4 h-4 text-default-400' />
                            <span>
                              {new Date(booking.date).toLocaleDateString(
                                'en-US',
                                {
                                  year: 'numeric',
                                  month: 'long',
                                  day: 'numeric',
                                }
                              )}
                            </span>
                          </div>

                          <div className='flex items-center gap-2 text-sm'>
                            <Users className='w-4 h-4 text-default-400' />
                            <span>
                              {booking.numParticipants} participant
                              {booking.numParticipants > 1 ? 's' : ''}
                            </span>
                          </div>

                          {booking.experience?.duration && (
                            <div className='flex items-center gap-2 text-sm'>
                              <Clock className='w-4 h-4 text-default-400' />
                              <span>{booking.experience.duration}</span>
                            </div>
                          )}

                          <div className='flex items-center gap-2 text-sm font-semibold'>
                            <DollarSign className='w-4 h-4 text-success' />
                            <span className='text-lg'>
                              ${booking.totalPrice}
                            </span>
                            {booking.isPaid ? (
                              <Chip color='success' size='sm' variant='flat'>
                                Paid
                              </Chip>
                            ) : null}
                          </div>

                          {!booking.isPaid &&
                            booking.status !== 'cancelled' && (
                              <div className='pt-2'>
                                <Chip color='warning' size='sm' variant='flat'>
                                  Payment pending
                                </Chip>
                              </div>
                            )}

                          <div className='flex gap-2 pt-4'>
                            {(booking.status === 'pending' ||
                              booking.status === 'confirmed') && (
                              <Button
                                color='danger'
                                isLoading={cancelExpBooking.isPending}
                                size='sm'
                                variant='flat'
                                onPress={async () => {
                                  try {
                                    await cancelExpBooking.mutateAsync(
                                      booking._id.toString()
                                    );
                                    addToast({
                                      title: 'Booking Cancelled',
                                      description:
                                        'Your experience booking has been cancelled.',
                                      color: 'success',
                                    });
                                  } catch {
                                    addToast({
                                      title: 'Error',
                                      description: 'Failed to cancel booking.',
                                      color: 'danger',
                                    });
                                  }
                                }}
                              >
                                Cancel
                              </Button>
                            )}
                          </div>
                        </div>
                      </CardBody>
                    </Card>
                  ))}
                </div>
              )}
          </Tab>

          <Tab key='dining' title='Dining Reservations'>
            {/* Dining Reservations Content */}
            <div className='mb-6 max-w-xs mt-4'>
              <Select
                label='Filter by Status'
                placeholder='Select status'
                selectedKeys={[diningStatusFilter]}
                onChange={e => setDiningStatusFilter(e.target.value)}
              >
                {diningStatusFilters.map(filter => (
                  <SelectItem key={filter.key}>{filter.label}</SelectItem>
                ))}
              </Select>
            </div>

            {diningLoading && (
              <div className='flex justify-center py-12'>
                <Spinner label='Loading dining reservations...' size='lg' />
              </div>
            )}

            {diningError && (
              <Card className='bg-danger-50 dark:bg-danger-900/20'>
                <CardBody>
                  <p className='text-danger'>
                    Failed to load dining reservations.
                  </p>
                </CardBody>
              </Card>
            )}

            {!diningLoading &&
              !diningError &&
              diningReservations?.length === 0 && (
                <Card>
                  <CardBody className='text-center py-12'>
                    <Calendar className='w-16 h-16 mx-auto mb-4 text-default-400' />
                    <h3 className='text-xl font-semibold mb-2'>
                      No dining reservations found
                    </h3>
                    <p className='text-default-500 mb-6'>
                      {diningStatusFilter === 'all'
                        ? "You haven't made any dining reservations yet."
                        : `No ${diningStatusFilter} dining reservations found.`}
                    </p>
                    <Button
                      color='primary'
                      onPress={() => router.push('/dining')}
                    >
                      Browse Dining
                    </Button>
                  </CardBody>
                </Card>
              )}

            {!diningLoading &&
              !diningError &&
              diningReservations &&
              diningReservations.length > 0 && (
                <div className='grid gap-6 md:grid-cols-2 lg:grid-cols-2'>
                  {diningReservations.map((reservation: any) => (
                    <Card key={reservation._id.toString()} className='w-full'>
                      <CardHeader className='flex gap-3'>
                        <div className='relative w-24 h-24 shrink-0 rounded-lg overflow-hidden'>
                          <Image
                            alt={reservation.dining?.name || 'Dining'}
                            className='object-cover'
                            fill
                            src={
                              reservation.dining?.image ||
                              '/placeholder-dining.jpg'
                            }
                          />
                        </div>
                        <div className='flex flex-col flex-1'>
                          <p className='text-lg font-bold'>
                            {reservation.dining?.name}
                          </p>
                          <Chip
                            className='mt-1 w-fit'
                            color={statusColorMap[reservation.status]}
                            size='sm'
                            variant='flat'
                          >
                            {reservation.status.toUpperCase().replace('-', ' ')}
                          </Chip>
                        </div>
                      </CardHeader>

                      <CardBody className='pt-0'>
                        <div className='space-y-3'>
                          <div className='flex items-center gap-2 text-sm'>
                            <Calendar className='w-4 h-4 text-default-400' />
                            <span>
                              {new Date(reservation.date).toLocaleDateString(
                                'en-US',
                                {
                                  year: 'numeric',
                                  month: 'long',
                                  day: 'numeric',
                                }
                              )}
                            </span>
                          </div>

                          <div className='flex items-center gap-2 text-sm'>
                            <Clock className='w-4 h-4 text-default-400' />
                            <span>{reservation.time}</span>
                          </div>

                          <div className='flex items-center gap-2 text-sm'>
                            <Users className='w-4 h-4 text-default-400' />
                            <span>
                              {reservation.numGuests} guest
                              {reservation.numGuests > 1 ? 's' : ''}
                            </span>
                          </div>

                          <div className='flex items-center gap-2 text-sm font-semibold'>
                            <DollarSign className='w-4 h-4 text-success' />
                            <span className='text-lg'>
                              ${reservation.totalPrice}
                            </span>
                            {reservation.isPaid ? (
                              <Chip color='success' size='sm' variant='flat'>
                                Paid
                              </Chip>
                            ) : null}
                          </div>

                          {!reservation.isPaid &&
                            reservation.status !== 'cancelled' &&
                            reservation.status !== 'no-show' && (
                              <div className='pt-2'>
                                <Chip color='warning' size='sm' variant='flat'>
                                  Payment pending
                                </Chip>
                              </div>
                            )}

                          <div className='flex gap-2 pt-4'>
                            {(reservation.status === 'pending' ||
                              reservation.status === 'confirmed') && (
                              <Button
                                color='danger'
                                isLoading={cancelDiningReservation.isPending}
                                size='sm'
                                variant='flat'
                                onPress={async () => {
                                  try {
                                    await cancelDiningReservation.mutateAsync(
                                      reservation._id.toString()
                                    );
                                    addToast({
                                      title: 'Reservation Cancelled',
                                      description:
                                        'Your dining reservation has been cancelled.',
                                      color: 'success',
                                    });
                                  } catch {
                                    addToast({
                                      title: 'Error',
                                      description:
                                        'Failed to cancel reservation.',
                                      color: 'danger',
                                    });
                                  }
                                }}
                              >
                                Cancel
                              </Button>
                            )}
                          </div>
                        </div>
                      </CardBody>
                    </Card>
                  ))}
                </div>
              )}
          </Tab>
        </Tabs>
      </div>

      {/* Booking Details Modal */}
      <Modal
        isOpen={isDetailsOpen}
        scrollBehavior='inside'
        size='2xl'
        onClose={onDetailsClose}
      >
        <ModalContent>
          {(onClose: () => void) => (
            <>
              <ModalHeader className='flex flex-col gap-1'>
                Booking Details
              </ModalHeader>
              <ModalBody>
                {selectedBooking && (
                  <div className='space-y-6'>
                    {/* Cabin Info */}
                    <div>
                      <h3 className='text-lg font-semibold mb-3'>
                        Cabin Information
                      </h3>
                      <div className='flex gap-4'>
                        <div className='relative w-32 h-32 shrink-0 rounded-lg overflow-hidden'>
                          <Image
                            className='object-cover'
                            fill
                            alt={
                              (selectedBooking as any).cabin?.name || 'Cabin'
                            }
                            src={
                              (selectedBooking as any).cabin?.image ||
                              '/placeholder-cabin.jpg'
                            }
                          />
                        </div>
                        <div>
                          <p className='font-semibold text-xl'>
                            {(selectedBooking as any).cabin?.name}
                          </p>
                          <p className='text-sm text-default-500 mt-1'>
                            {(selectedBooking as any).cabin?.description}
                          </p>
                          <Chip
                            className='mt-2'
                            color={statusColorMap[selectedBooking.status]}
                            size='sm'
                            variant='flat'
                          >
                            {selectedBooking.status
                              .replace('-', ' ')
                              .toUpperCase()}
                          </Chip>
                        </div>
                      </div>
                    </div>

                    {/* Booking Dates */}
                    <div>
                      <h3 className='text-lg font-semibold mb-3'>Dates</h3>
                      <div className='grid grid-cols-2 gap-4'>
                        <div>
                          <p className='text-sm text-default-500'>Check-in</p>
                          <p className='font-medium'>
                            {formatDate(selectedBooking.checkInDate)}
                          </p>
                        </div>
                        <div>
                          <p className='text-sm text-default-500'>Check-out</p>
                          <p className='font-medium'>
                            {formatDate(selectedBooking.checkOutDate)}
                          </p>
                        </div>
                      </div>
                      <p className='text-sm text-default-500 mt-2'>
                        {selectedBooking.numNights} nights •{' '}
                        {selectedBooking.numGuests} guests
                      </p>
                    </div>

                    {/* Pricing */}
                    <div>
                      <h3 className='text-lg font-semibold mb-3'>Pricing</h3>
                      <div className='space-y-2'>
                        <div className='flex justify-between'>
                          <span>Cabin Price</span>
                          <span>${selectedBooking.cabinPrice}</span>
                        </div>
                        {selectedBooking.extrasPrice > 0 && (
                          <div className='flex justify-between'>
                            <span>Extras</span>
                            <span>${selectedBooking.extrasPrice}</span>
                          </div>
                        )}
                        <div className='flex justify-between font-semibold text-lg pt-2 border-t'>
                          <span>Total</span>
                          <span>${selectedBooking.totalPrice}</span>
                        </div>
                        <div className='flex justify-between text-sm'>
                          <span>Payment Status</span>
                          <Chip
                            size='sm'
                            variant='flat'
                            color={
                              selectedBooking.isPaid ? 'success' : 'warning'
                            }
                          >
                            {selectedBooking.isPaid ? 'Paid' : 'Pending'}
                          </Chip>
                        </div>
                      </div>
                    </div>

                    {/* Deposit / Remaining */}
                    {selectedBooking.depositAmount > 0 && (
                      <div>
                        <h3 className='text-lg font-semibold mb-3'>
                          Deposit & Balance
                        </h3>
                        <div className='space-y-2'>
                          <div className='flex justify-between items-center'>
                            <span>Deposit</span>
                            <div className='flex items-center gap-2'>
                              <span>${selectedBooking.depositAmount}</span>
                              <Chip
                                size='sm'
                                variant='flat'
                                color={
                                  selectedBooking.depositPaid
                                    ? 'success'
                                    : 'warning'
                                }
                              >
                                {selectedBooking.depositPaid ? 'Paid' : 'Due'}
                              </Chip>
                            </div>
                          </div>
                          <div className='flex justify-between items-center'>
                            <span>Remaining</span>
                            <div className='flex items-center gap-2'>
                              <span>
                                $
                                {selectedBooking.remainingAmount ??
                                  selectedBooking.totalPrice -
                                    selectedBooking.depositAmount}
                              </span>
                              {(selectedBooking.remainingAmount ??
                                selectedBooking.totalPrice -
                                  selectedBooking.depositAmount) > 0 && (
                                <Chip color='warning' size='sm' variant='flat'>
                                  Outstanding
                                </Chip>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Refund / Cancellation Info */}
                    {selectedBooking.status === 'cancelled' &&
                      selectedBooking.refundStatus &&
                      selectedBooking.refundStatus !== 'none' && (
                        <div>
                          <h3 className='text-lg font-semibold mb-3'>
                            Refund Information
                          </h3>
                          <div className='space-y-2'>
                            <div className='flex justify-between items-center'>
                              <span>Refund Status</span>
                              <Chip
                                size='sm'
                                variant='flat'
                                color={
                                  (
                                    {
                                      pending: 'warning',
                                      processing: 'primary',
                                      partial: 'warning',
                                      full: 'success',
                                      failed: 'danger',
                                    } as const
                                  )[
                                    selectedBooking.refundStatus as
                                      | 'pending'
                                      | 'processing'
                                      | 'partial'
                                      | 'full'
                                      | 'failed'
                                  ] || 'default'
                                }
                              >
                                {selectedBooking.refundStatus
                                  .charAt(0)
                                  .toUpperCase() +
                                  selectedBooking.refundStatus.slice(1)}
                              </Chip>
                            </div>
                            {selectedBooking.refundAmount != null &&
                              selectedBooking.refundAmount > 0 && (
                                <div className='flex justify-between'>
                                  <span>Refund Amount</span>
                                  <span>${selectedBooking.refundAmount}</span>
                                </div>
                              )}
                            {selectedBooking.cancelledAt && (
                              <div className='flex justify-between'>
                                <span>Cancelled</span>
                                <span>
                                  {formatDate(selectedBooking.cancelledAt)}
                                </span>
                              </div>
                            )}
                            {selectedBooking.cancellationReason && (
                              <div className='flex justify-between'>
                                <span>Reason</span>
                                <span className='text-right max-w-[60%] text-default-600'>
                                  {selectedBooking.cancellationReason}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                    {/* Extras */}
                    {selectedBooking.extras && (
                      <div>
                        <h3 className='text-lg font-semibold mb-3'>Extras</h3>
                        <div className='flex flex-wrap gap-2'>
                          {selectedBooking.extras.hasBreakfast && (
                            <Chip size='sm' variant='flat'>
                              Breakfast
                            </Chip>
                          )}
                          {selectedBooking.extras.hasPets && (
                            <Chip size='sm' variant='flat'>
                              Pets
                            </Chip>
                          )}
                          {selectedBooking.extras.hasParking && (
                            <Chip size='sm' variant='flat'>
                              Parking
                            </Chip>
                          )}
                          {selectedBooking.extras.hasEarlyCheckIn && (
                            <Chip size='sm' variant='flat'>
                              Early Check-in
                            </Chip>
                          )}
                          {selectedBooking.extras.hasLateCheckOut && (
                            <Chip size='sm' variant='flat'>
                              Late Check-out
                            </Chip>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Special Requests */}
                    {selectedBooking.observations && (
                      <div>
                        <h3 className='text-lg font-semibold mb-3'>
                          Observations
                        </h3>
                        <p className='text-sm text-default-600'>
                          {selectedBooking.observations}
                        </p>
                      </div>
                    )}

                    {selectedBooking.specialRequests &&
                      selectedBooking.specialRequests.length > 0 && (
                        <div>
                          <h3 className='text-lg font-semibold mb-3'>
                            Special Requests
                          </h3>
                          <ul className='list-disc list-inside space-y-1'>
                            {selectedBooking.specialRequests.map(
                              (request, index) => (
                                <li
                                  key={index}
                                  className='text-sm text-default-600'
                                >
                                  {request}
                                </li>
                              )
                            )}
                          </ul>
                        </div>
                      )}
                  </div>
                )}
              </ModalBody>
              <ModalFooter>
                <Button variant='light' onPress={onClose}>
                  Close
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>

      {/* Cancel Booking Modal */}
      <Modal isOpen={isCancelOpen} onClose={onCancelClose}>
        <ModalContent>
          {(onClose: () => void) => (
            <>
              <ModalHeader className='flex flex-col gap-1'>
                Cancel Booking
              </ModalHeader>
              <ModalBody>
                <p>
                  Are you sure you want to cancel your booking at{' '}
                  <span className='font-semibold'>
                    {(selectedBooking as any)?.cabin?.name}
                  </span>
                  ?
                </p>
                <p className='text-sm text-default-500 mt-2'>
                  This action cannot be undone. Please review our cancellation
                  policy for any applicable fees.
                </p>
              </ModalBody>
              <ModalFooter>
                <Button variant='light' onPress={onClose}>
                  Keep Booking
                </Button>
                <Button
                  color='danger'
                  isLoading={cancelBooking.isPending}
                  onPress={confirmCancelBooking}
                >
                  Cancel Booking
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>

      {/* Edit Booking Modal */}
      <Modal
        isOpen={isEditOpen}
        scrollBehavior='inside'
        size='2xl'
        onClose={onEditClose}
      >
        <ModalContent>
          {(onClose: () => void) => (
            <>
              <ModalHeader className='flex flex-col gap-1'>
                Edit Booking
                <p className='text-sm font-normal text-default-500'>
                  Update your booking details for{' '}
                  {(selectedBooking as any)?.cabin?.name || 'your cabin'}
                </p>
              </ModalHeader>
              <ModalBody>
                <div className='space-y-4'>
                  {/* Check-in Date */}
                  <div>
                    <label className='text-sm font-medium mb-2 block'>
                      Check-in Date
                    </label>
                    <Input
                      type='date'
                      value={editFormData.checkInDate}
                      onChange={e =>
                        setEditFormData(prev => ({
                          ...prev,
                          checkInDate: e.target.value,
                        }))
                      }
                    />
                  </div>

                  {/* Check-out Date */}
                  <div>
                    <label className='text-sm font-medium mb-2 block'>
                      Check-out Date
                    </label>
                    <Input
                      type='date'
                      value={editFormData.checkOutDate}
                      onChange={e =>
                        setEditFormData(prev => ({
                          ...prev,
                          checkOutDate: e.target.value,
                        }))
                      }
                    />
                  </div>

                  {/* Number of Guests */}
                  <div>
                    <label className='text-sm font-medium mb-2 block'>
                      Number of Guests
                    </label>
                    <Input
                      max={(selectedBooking as any)?.cabin?.maxCapacity || 10}
                      min={1}
                      type='number'
                      value={editFormData.numGuests.toString()}
                      onChange={e =>
                        setEditFormData(prev => ({
                          ...prev,
                          numGuests: parseInt(e.target.value) || 1,
                        }))
                      }
                    />
                    {(selectedBooking as any)?.cabin?.maxCapacity && (
                      <p className='text-xs text-default-400 mt-1'>
                        Maximum capacity:{' '}
                        {(selectedBooking as any).cabin.maxCapacity} guests
                      </p>
                    )}
                  </div>

                  {/* Observations */}
                  <div>
                    <label className='text-sm font-medium mb-2 block'>
                      Special Requests / Observations
                    </label>
                    <Input
                      placeholder='Any special requests or notes...'
                      value={editFormData.observations}
                      onChange={e =>
                        setEditFormData(prev => ({
                          ...prev,
                          observations: e.target.value,
                        }))
                      }
                    />
                  </div>

                  {/* Info Box */}
                  <div className='bg-primary/10 rounded-lg p-3'>
                    <p className='text-sm text-default-700'>
                      <strong>Note:</strong> Changes to dates may affect
                      pricing. You&apos;ll be notified of any price changes
                      before finalizing the update.
                    </p>
                  </div>
                </div>
              </ModalBody>
              <ModalFooter>
                <Button variant='light' onPress={onClose}>
                  Cancel
                </Button>
                <Button
                  color='primary'
                  isLoading={updateBooking.isPending}
                  onPress={confirmUpdateBooking}
                >
                  Update Booking
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </section>
  );
}
