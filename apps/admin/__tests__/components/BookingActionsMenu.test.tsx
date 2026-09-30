import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import type { PropsWithChildren, ReactNode } from 'react';
import type { BookingStatus } from '@/lib/config';
import BookingActionsMenu from '@/components/BookingsTable/BookingActionsMenu';

jest.mock('@heroui/dropdown', () => ({
  Dropdown: ({ children }: PropsWithChildren) => <div>{children}</div>,
  DropdownTrigger: ({ children }: PropsWithChildren) => <div>{children}</div>,
  DropdownMenu: ({ children }: PropsWithChildren) => (
    <div role='menu'>{children}</div>
  ),
  DropdownItem: ({
    children,
    onPress,
  }: {
    children: ReactNode;
    onPress?: () => void;
  }) => (
    <button role='menuitem' onClick={onPress}>
      {children}
    </button>
  ),
}));
jest.mock('@heroui/button', () => ({
  Button: ({ children }: PropsWithChildren) => <button>{children}</button>,
}));

function row(status: BookingStatus) {
  return {
    _id: '507f1f77bcf86cd799439011',
    status,
    reference: 'Preserved callback data',
  };
}

describe('booking action characterization', () => {
  test('retains the original booking for view, edit and delete callbacks', () => {
    const booking = row('unconfirmed');
    const onViewDetails = jest.fn();
    const onEdit = jest.fn();
    const onDelete = jest.fn();
    render(
      <BookingActionsMenu
        booking={booking}
        onViewDetails={onViewDetails}
        onEdit={onEdit}
        onDelete={onDelete}
      />
    );
    fireEvent.click(screen.getByRole('menuitem', { name: 'View Details' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Edit Booking' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Delete Booking' }));
    for (const callback of [onViewDetails, onEdit, onDelete]) {
      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback.mock.calls[0][0]).toBe(booking);
    }
  });
  test('checks out a checked-in booking with the correct identity', () => {
    const booking = row('checked-in');
    const onStatusChange = jest.fn();
    render(
      <BookingActionsMenu booking={booking} onStatusChange={onStatusChange} />
    );
    fireEvent.click(screen.getByRole('menuitem', { name: 'Check Out' }));
    expect(onStatusChange).toHaveBeenCalledWith({
      bookingId: booking._id,
      status: 'checked-out',
    });
    expect(
      screen.queryByRole('menuitem', { name: 'Check In' })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('menuitem', { name: 'Cancel Booking' })
    ).not.toBeInTheDocument();
  });
  test('cancels an unconfirmed booking with the correct identity', () => {
    const booking = row('unconfirmed');
    const onStatusChange = jest.fn();
    render(
      <BookingActionsMenu booking={booking} onStatusChange={onStatusChange} />
    );
    fireEvent.click(screen.getByRole('menuitem', { name: 'Cancel Booking' }));
    expect(onStatusChange).toHaveBeenCalledWith({
      bookingId: booking._id,
      status: 'cancelled',
    });
  });
  test.each<BookingStatus>([
    'confirmed',
    'checked-in',
    'checked-out',
    'cancelled',
  ])('does not offer editing for %s', status => {
    render(
      <BookingActionsMenu
        booking={row(status)}
        onEdit={jest.fn()}
        onViewDetails={jest.fn()}
      />
    );
    expect(
      screen.queryByRole('menuitem', { name: 'Edit Booking' })
    ).not.toBeInTheDocument();
  });
  test.each<BookingStatus>(['checked-out', 'cancelled'])(
    'does not offer status changes for terminal %s bookings',
    status => {
      render(
        <BookingActionsMenu
          booking={row(status)}
          onStatusChange={jest.fn()}
          onViewDetails={jest.fn()}
        />
      );
      expect(
        screen.getAllByRole('menuitem').map(item => item.textContent)
      ).toEqual(['View Details']);
    }
  );
  test('omits status actions without a status handler', () => {
    render(
      <BookingActionsMenu
        booking={row('unconfirmed')}
        onViewDetails={jest.fn()}
      />
    );
    expect(
      screen.getAllByRole('menuitem').map(item => item.textContent)
    ).toEqual(['View Details']);
  });
});

describe('booking action transition regressions', () => {
  test('offers check-in for confirmed bookings, matching the API and detail page', () => {
    const booking = row('confirmed');
    const onStatusChange = jest.fn();
    render(
      <BookingActionsMenu booking={booking} onStatusChange={onStatusChange} />
    );
    fireEvent.click(screen.getByRole('menuitem', { name: 'Check In' }));
    expect(onStatusChange).toHaveBeenCalledWith({
      bookingId: booking._id,
      status: 'checked-in',
    });
  });
  test('does not offer the forbidden direct unconfirmed-to-checked-in transition', () => {
    render(
      <BookingActionsMenu
        booking={row('unconfirmed')}
        onStatusChange={jest.fn()}
      />
    );
    expect(
      screen.queryByRole('menuitem', { name: 'Check In' })
    ).not.toBeInTheDocument();
  });
});
