/** @jest-environment node */
import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Types } from 'mongoose';

const mockAuth = jest.fn<Promise<{ userId: string | null }>, []>();
const mockCurrentUser = jest.fn();
const mockPopulate = jest.fn();
const mockSend = jest.fn<
  Promise<{ data?: { id: string }; error?: { message: string } }>,
  [{ react: ReactNode; from: string; to: string; subject: string }]
>();
jest.mock('@clerk/nextjs/server', () => ({
  auth: () => mockAuth(),
  currentUser: () => mockCurrentUser(),
}));
jest.mock('@lodgeflow/database', () => ({
  connectDB: jest.fn(),
  Booking: { findById: jest.fn(() => ({ populate: mockPopulate })) },
}));
jest.mock('@/lib/resend', () => ({
  getResend: () => ({ emails: { send: mockSend } }),
}));
import { POST } from '@/app/api/send/confirm/route';
import { Booking, connectDB } from '@lodgeflow/database';

function booking() {
  return {
    _id: new Types.ObjectId('507f1f77bcf86cd7994390ab'),
    customer: 'customer',
    cabin: {
      name: 'Pine Cabin',
      capacity: 4,
      price: 125.25,
      description: 'A quiet retreat beside the lake.',
      amenities: ['Fireplace', 'Kitchen'],
    },
    checkInDate: new Date('2030-06-03T15:00:00Z'),
    checkOutDate: new Date('2030-06-05T15:00:00Z'),
    numNights: 2,
    numGuests: 3,
    cabinPrice: 125.25,
    extrasPrice: 98.25,
    totalPrice: 348.75,
    depositAmount: 90,
    remainingAmount: 348.75,
    extras: {
      hasBreakfast: true,
      breakfastPrice: 50.25,
      hasPets: true,
      petFee: 20,
      hasParking: true,
      parkingFee: 12,
      hasEarlyCheckIn: true,
      earlyCheckInFee: 7,
      hasLateCheckOut: true,
      lateCheckOutFee: 9,
    },
    payments: [],
    observations: 'Internal booking note',
    checkoutToken: 'private-quote',
  };
}
function request(body: object = { bookingId: booking()._id.toHexString() }) {
  return new Request('http://localhost/api/send/confirm', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}
function emailText() {
  return renderToStaticMarkup(mockSend.mock.calls[0][0].react).replace(
    /<[^>]+>/g,
    ''
  );
}

const originalSender = process.env.LODGEFLOW_NOTIFICATION_EMAIL_FROM;
beforeEach(() => {
  jest.resetAllMocks();
  delete process.env.LODGEFLOW_NOTIFICATION_EMAIL_FROM;
  (Booking.findById as jest.Mock).mockReturnValue({ populate: mockPopulate });
  mockAuth.mockResolvedValue({ userId: 'customer' });
  mockCurrentUser.mockResolvedValue({
    firstName: 'Avery',
    emailAddresses: [
      { emailAddress: 'guest@example.com' },
      { emailAddress: 'second@example.com' },
    ],
  });
  mockPopulate.mockResolvedValue(booking());
  mockSend.mockResolvedValue({ data: { id: 'message' } });
});
afterEach(() => {
  if (originalSender === undefined)
    delete process.env.LODGEFLOW_NOTIFICATION_EMAIL_FROM;
  else process.env.LODGEFLOW_NOTIFICATION_EMAIL_FROM = originalSender;
});

test('renders the existing stay, cabin, extras and unpaid deposit details from persisted fields', async () => {
  const response = await POST(
    request({
      bookingId: booking()._id.toHexString(),
      totalPrice: 1,
      depositAmount: 0,
      email: 'attacker@example.com',
    })
  );
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ id: 'message' });
  expect(mockSend).toHaveBeenCalledWith(
    expect.objectContaining({
      from: 'LodgeFlow <notifications@lodgeflow.app>',
      to: 'guest@example.com',
      subject: 'Booking Confirmation',
    })
  );
  const text = emailText();
  for (const expected of [
    'Your reservation is all set, Avery!',
    'Booking ID:#994390AB',
    'Check-in:Monday, June 3, 2030',
    'Check-out:Wednesday, June 5, 2030',
    'Duration:2 nights',
    'Guests:3 guests',
    'Cabin:Pine Cabin',
    'Capacity:Up to 4 guests',
    'Nightly Rate:$125.25',
    'Description:A quiet retreat beside the lake.',
    'Amenities:FireplaceKitchen',
    'Cabin (2 nights):$250.50',
    'Breakfast:$50.25',
    'Pet Fee:$20.00',
    'Parking:$12.00',
    'Early Check-in:$7.00',
    'Late Check-out:$9.00',
    'Extras Subtotal:$98.25',
    'Total:$348.75',
    'Required Deposit:$90.00',
    'Remaining Balance:$348.75',
    'Check-in time: 3:00 PM',
    'Check-out time: 11:00 AM',
  ])
    expect(text).toContain(expected);
  expect(text).not.toContain('private-quote');
  expect(text).not.toContain('Internal booking note');
});

test('omits unselected extras, empty amenities and a zero deposit, retaining Guest and singular guest text', async () => {
  const row = booking();
  mockPopulate.mockResolvedValue({
    ...row,
    numGuests: 1,
    depositAmount: 0,
    cabin: { ...row.cabin, amenities: [] },
    extras: {
      ...row.extras,
      hasBreakfast: false,
      hasPets: false,
      hasParking: false,
      hasEarlyCheckIn: false,
      hasLateCheckOut: false,
    },
  });
  mockCurrentUser.mockResolvedValue({
    emailAddresses: [{ emailAddress: 'guest@example.com' }],
  });
  expect((await POST(request())).status).toBe(200);
  const text = emailText();
  expect(text).toContain('Your reservation is all set, Guest!');
  expect(text).toContain('Guests:1 guest');
  expect(text).not.toContain('Guests:1 guests');
  for (const omitted of [
    'Add-ons:',
    'Amenities:',
    'Required Deposit:',
    'Remaining Balance:',
  ])
    expect(text).not.toContain(omitted);
});

test('retains the required deposit while displaying the balance after received payments', async () => {
  mockPopulate.mockResolvedValue({ ...booking(), remainingAmount: 248.75 });
  expect((await POST(request())).status).toBe(200);
  expect(emailText()).toContain('Required Deposit:$90.00');
  expect(emailText()).toContain('Remaining Balance:$248.75');
});

test('shows the booked cabin subtotal across nights even when the catalog price changes', async () => {
  const row = booking();
  mockPopulate.mockResolvedValue({
    ...row,
    cabin: { ...row.cabin, price: 200 },
    numNights: 3,
    cabinPrice: 100,
    totalPrice: 398.25,
    remainingAmount: 398.25,
  });
  expect((await POST(request())).status).toBe(200);
  expect(emailText()).toContain('Cabin (3 nights):$300.00');
  expect(emailText()).toContain('Extras Subtotal:$98.25');
  expect(emailText()).toContain('Total:$398.25');
});

test('requires authentication before reading the body or database', async () => {
  mockAuth.mockResolvedValue({ userId: null });
  const response = await POST(
    new Request('http://localhost/api/send/confirm', {
      method: 'POST',
      body: 'invalid json',
    })
  );
  expect(response.status).toBe(401);
  expect(await response.json()).toEqual({ error: 'Authentication required' });
  expect(connectDB).not.toHaveBeenCalled();
  expect(mockSend).not.toHaveBeenCalled();
});

test('rejects a missing booking ID before database access', async () => {
  const response = await POST(request({}));
  expect(response.status).toBe(400);
  expect(await response.json()).toEqual({ error: 'Booking ID is required' });
  expect(connectDB).not.toHaveBeenCalled();
  expect(mockSend).not.toHaveBeenCalled();
});

test.each([
  { row: null, status: 404, error: 'Booking not found' },
  {
    row: { ...booking(), customer: 'foreign' },
    status: 403,
    error: 'Not authorized to send this confirmation',
  },
])('preserves booking denial: $status', async ({ row, status, error }) => {
  mockPopulate.mockResolvedValue(row);
  const response = await POST(request());
  expect(response.status).toBe(status);
  expect(await response.json()).toEqual({ error });
  expect(mockCurrentUser).not.toHaveBeenCalled();
  expect(mockSend).not.toHaveBeenCalled();
});

test.each([undefined, 'invalid'])(
  'rejects unusable recipient %s before sending',
  async emailAddress => {
    mockCurrentUser.mockResolvedValue({ emailAddresses: [{ emailAddress }] });
    const response = await POST(request());
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'Invalid email address' });
    expect(mockSend).not.toHaveBeenCalled();
  }
);

test('honors a lazy notification sender override and rejects invalid configuration', async () => {
  process.env.LODGEFLOW_NOTIFICATION_EMAIL_FROM = 'updates@example.com';
  expect((await POST(request())).status).toBe(200);
  expect(mockSend).toHaveBeenCalledWith(
    expect.objectContaining({ from: 'LodgeFlow <updates@example.com>' })
  );
  mockSend.mockClear();
  process.env.LODGEFLOW_NOTIFICATION_EMAIL_FROM = '';
  expect((await POST(request())).status).toBe(500);
  expect(mockSend).not.toHaveBeenCalled();
});

test('provider rejection and exceptions allow a retry without changing booking state', async () => {
  const row = booking();
  const before = JSON.stringify(row);
  mockPopulate.mockResolvedValue(row);
  mockSend.mockResolvedValueOnce({
    error: { message: 'Provider unavailable' },
  });
  expect((await POST(request())).status).toBe(500);
  mockSend.mockRejectedValueOnce(new Error('Transport unavailable'));
  expect((await POST(request())).status).toBe(500);
  const retried = await POST(request());
  expect(retried.status).toBe(200);
  expect(await retried.json()).toEqual({ id: 'message' });
  expect(JSON.stringify(row)).toBe(before);
});

test('database or identity lookup failure never dispatches email', async () => {
  mockPopulate.mockRejectedValueOnce(new Error('Database unavailable'));
  expect((await POST(request())).status).toBe(500);
  mockCurrentUser.mockRejectedValueOnce(new Error('Identity unavailable'));
  expect((await POST(request())).status).toBe(500);
  expect(mockSend).not.toHaveBeenCalled();
});

test('reports a deleted cabin before rendering or sending a confirmation', async () => {
  mockPopulate.mockResolvedValue({ ...booking(), cabin: null });
  const response = await POST(request());
  expect(response.status).toBe(404);
  expect(await response.json()).toEqual({ error: 'Cabin not found' });
  expect(mockSend).not.toHaveBeenCalled();
});
