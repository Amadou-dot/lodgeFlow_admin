'use client';

import type { PopulatedBooking } from '@/types';
import { Spinner } from '@heroui/spinner';
import {
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
} from '@heroui/table';
import BookingTableCell from './BookingTableCell';

interface BookingTableDesktopProps {
  bookings: PopulatedBooking[];
  isLoading: boolean;
  onStatusChange?: (bookingId: string, newStatus: string) => void;
  onViewDetails?: (booking: PopulatedBooking) => void;
  onEdit?: (booking: PopulatedBooking) => void;
  onDelete?: (booking: PopulatedBooking) => void;
}

export default function BookingTableDesktop({
  bookings,
  isLoading,
  onStatusChange,
  onViewDetails,
  onEdit,
  onDelete,
}: BookingTableDesktopProps) {
  const columns = [
    { key: 'cabin', label: 'Cabin' },
    { key: 'guest', label: 'Guest' },
    { key: 'dates', label: 'Dates' },
    { key: 'status', label: 'Status' },
    { key: 'amount', label: 'Amount' },
    { key: 'actions', label: 'Actions' },
  ];

  // Determine loading state: show loading only if we have no data and are loading
  const loadingState = isLoading && bookings.length === 0 ? 'loading' : 'idle';

  return (
    <Table
      aria-label='Bookings table'
      removeWrapper
      classNames={{
        base: 'max-h-[600px] overflow-auto',
        table: 'min-h-[400px] table-fixed w-full',
        thead: '[&>tr]:first:shadow-none',
        tbody: 'divide-y divide-default-200',
        tr: 'group-data-[odd]:bg-default-50 hover:bg-default-100 transition-colors',
        th: 'bg-default-100 text-default-700 font-semibold',
        td: 'py-4 text-default-600 group-data-[selected]:text-default-foreground',
      }}
    >
      <TableHeader columns={columns}>
        {column => (
          <TableColumn
            key={column.key}
            align={column.key === 'amount' ? 'end' : 'start'}
            className={`${column.key === 'actions' ? 'text-center w-20' : ''} ${
              column.key === 'cabin' ? 'w-[120px]' : ''
            } ${column.key === 'guest' ? 'w-[180px]' : ''} ${
              column.key === 'dates' ? 'w-[140px]' : ''
            } ${column.key === 'status' ? 'w-[100px]' : ''} ${
              column.key === 'amount' ? 'w-[120px]' : ''
            }`}
          >
            {column.label}
          </TableColumn>
        )}
      </TableHeader>
      <TableBody
        items={bookings || []}
        isLoading={isLoading}
        loadingContent={<Spinner label='Loading bookings...' />}
        loadingState={loadingState}
        emptyContent='No bookings found'
      >
        {booking => (
          <TableRow key={booking._id.toString()}>
            {columnKey => (
              <TableCell className='overflow-hidden'>
                <BookingTableCell
                  booking={booking}
                  columnKey={columnKey as string}
                  onStatusChange={onStatusChange}
                  onViewDetails={onViewDetails}
                  onEdit={onEdit}
                  onDelete={onDelete}
                />
              </TableCell>
            )}
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
}
