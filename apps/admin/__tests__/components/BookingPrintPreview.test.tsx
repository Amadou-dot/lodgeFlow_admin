import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import html2canvas from 'html2canvas';
import QuickActionsCard from '@/components/BookingDetails/QuickActionsCard';
import type { PopulatedBooking } from '@/types';

const mockSave = jest.fn();
jest.mock('html2canvas', () => ({ __esModule: true, default: jest.fn() }));
jest.mock('jspdf', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    addImage: jest.fn(),
    save: mockSave,
    internal: { pageSize: { getWidth: () => 210, getHeight: () => 297 } },
  })),
}));
jest.mock('@/hooks/useBookings', () => ({
  useBookingByEmail: () => ({ data: null, isLoading: false }),
  useRecordPayment: () => ({ mutateAsync: jest.fn(), isPending: false }),
}));
jest.mock('@/hooks/useCabins', () => ({
  useCabin: () => ({ data: null, isLoading: false }),
}));
jest.mock('@/hooks/useSendEmail', () => ({
  useSendConfirmationEmail: () => ({ sendConfirmationEmail: jest.fn() }),
}));

const booking: PopulatedBooking = {
  _id: '507f1f77bcf86cd799439011',
  id: '507f1f77bcf86cd799439011',
  guest: null,
  cabin: null,
  customer: null,
  checkInDate: '2040-01-01',
  checkOutDate: '2040-01-02',
  numNights: 1,
  numGuests: 1,
  status: 'confirmed',
  cabinPrice: 10,
  extrasPrice: 0,
  totalPrice: 10,
  depositAmount: 0,
  amountPaid: 0,
  remainingAmount: 10,
  isPaid: false,
  depositPaid: false,
};

beforeEach(() => {
  jest.clearAllMocks();
  const canvas = document.createElement('canvas');
  canvas.width = 100;
  canvas.height = 100;
  jest.spyOn(canvas, 'toDataURL').mockReturnValue('data:image/png;base64,test');
  jest.mocked(html2canvas).mockResolvedValue(canvas);
});
afterEach(() => jest.restoreAllMocks());

test('opens the real preview before exporting and permits retry and reopening', async () => {
  jest.mocked(html2canvas).mockRejectedValueOnce(new Error('Canvas failed'));
  render(
    <QuickActionsCard
      booking={booking}
      onCheckIn={() => {}}
      onCheckOut={() => {}}
      actionLoading={null}
    />
  );
  expect(document.getElementById('booking-pdf-template')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Print / Download' }));
  await screen.findByText('Print Preview');
  expect(screen.getByRole('button', { name: 'Print' })).toBeEnabled();
  const template = document.getElementById('booking-pdf-template');
  expect(template).toHaveTextContent('Booking Details');
  fireEvent.click(screen.getByRole('button', { name: 'Download PDF' }));
  await waitFor(() => expect(html2canvas).toHaveBeenCalledTimes(1));
  expect(html2canvas).toHaveBeenCalledWith(template, expect.any(Object));
  expect(mockSave).not.toHaveBeenCalled();
  expect(screen.getByText('Print Preview')).toBeInTheDocument();
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Download PDF' })).toBeEnabled()
  );
  fireEvent.click(screen.getByRole('button', { name: 'Download PDF' }));
  await waitFor(() => expect(mockSave).toHaveBeenCalledTimes(1));
  await waitFor(() =>
    expect(screen.queryByText('Print Preview')).not.toBeInTheDocument()
  );
  fireEvent.click(screen.getByRole('button', { name: 'Print / Download' }));
  await screen.findByText('Print Preview');
  expect(document.querySelectorAll('#booking-pdf-template')).toHaveLength(1);
});
