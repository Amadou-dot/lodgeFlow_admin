/** @jest-environment node */
import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Types } from 'mongoose';
import type { IExperience, IExperienceBooking } from '@lodgeflow/database';

type BookingRow = Pick<
  IExperienceBooking,
  | 'customer'
  | 'date'
  | 'timeSlot'
  | 'numParticipants'
  | 'totalPrice'
  | 'isPaid'
  | 'status'
  | 'paymentConfirmationSentAt'
> & { _id: Types.ObjectId; experience: IExperience | null };
type Email = { react: ReactNode; from: string; to: string; subject: string };
const mockAuth = jest.fn<Promise<{ userId: string | null }>, []>();
const mockCurrentUser = jest.fn();
const mockGetUser = jest.fn();
const mockPopulate = jest.fn<Promise<BookingRow | null>, [string]>();
const mockFind = jest.fn(() => ({
  populate: (path: string) => ({ lean: () => mockPopulate(path) }),
}));
const mockDiningPopulate = jest.fn();
const mockDiningUpdate = jest.fn();
const mockUpdate = jest.fn();
const mockConnect = jest.fn();
const mockSend = jest.fn<
  Promise<{ data: { id: string } | null; error: { message: string } | null }>,
  [Email, { idempotencyKey: string }?]
>();
jest.mock('@clerk/nextjs/server', () => ({
  auth: () => mockAuth(),
  currentUser: () => mockCurrentUser(),
  clerkClient: async () => ({ users: { getUser: mockGetUser } }),
}));
jest.mock('@lodgeflow/database', () => ({
  connectDB: () => mockConnect(),
  ExperienceBooking: {
    findById: () => mockFind(),
    updateOne: (...args: unknown[]) => mockUpdate(...args),
  },
  DiningReservation: {
    findById: () => ({ populate: () => ({ lean: mockDiningPopulate }) }),
    updateOne: (...args: unknown[]) => mockDiningUpdate(...args),
  },
}));
jest.mock('@/lib/resend', () => ({
  getResend: () => ({ emails: { send: mockSend } }),
}));
import { POST } from '@/app/api/send/experience-confirm/route';
import { sendReservationConfirmation } from '@/lib/reservation-confirmation-email';

const bookingId = '507f1f77bcf86cd7994390ab';
function experience(): IExperience {
  return {
    name: 'Guided Kayak',
    price: 37.5,
    duration: '2 hours',
    difficulty: 'Easy',
    category: 'Water',
    description: 'Paddle the lake',
    image: 'https://example.invalid/kayak.jpg',
    includes: ['Guide', 'Safety gear'],
    available: ['Monday'],
    ctaText: 'Book now',
    isPopular: false,
    location: 'North dock',
    whatToBring: ['Water', 'Sunscreen'],
    createdAt: new Date('2029-01-01'),
    updatedAt: new Date('2029-01-01'),
  };
}
function booking(overrides: Partial<BookingRow> = {}): BookingRow {
  return {
    _id: new Types.ObjectId(bookingId),
    customer: 'customer',
    date: new Date('2030-06-03T15:00:00Z'),
    timeSlot: '15:00',
    numParticipants: 2,
    totalPrice: 75,
    isPaid: true,
    status: 'confirmed',
    experience: experience(),
    ...overrides,
  };
}
function request(body: object = { bookingId }) {
  return new Request('http://localhost/api/send/experience-confirm', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}
function emailText() {
  return renderToStaticMarkup(mockSend.mock.calls.at(-1)![0].react).replace(
    /<[^>]+>/g,
    ''
  );
}
const originalPayment = process.env.LODGEFLOW_PAYMENT_EMAIL_FROM;
const originalNotification = process.env.LODGEFLOW_NOTIFICATION_EMAIL_FROM;
beforeEach(() => {
  jest.clearAllMocks();
  delete process.env.LODGEFLOW_PAYMENT_EMAIL_FROM;
  delete process.env.LODGEFLOW_NOTIFICATION_EMAIL_FROM;
  mockAuth.mockResolvedValue({ userId: 'customer' });
  const user = {
    firstName: 'Avery',
    primaryEmailAddressId: 'primary',
    emailAddresses: [
      { id: 'first', emailAddress: 'first@example.com' },
      { id: 'primary', emailAddress: 'primary@example.com' },
    ],
  };
  mockCurrentUser.mockResolvedValue(user);
  mockGetUser.mockResolvedValue(user);
  mockPopulate.mockResolvedValue(booking());
  mockSend.mockResolvedValue({ data: { id: 'message' }, error: null });
});
afterEach(() => {
  for (const [key, value] of [
    ['LODGEFLOW_PAYMENT_EMAIL_FROM', originalPayment],
    ['LODGEFLOW_NOTIFICATION_EMAIL_FROM', originalNotification],
  ] as const) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe('experience confirmation characterization', () => {
  test('manual confirmation renders saved reservation fields and catalog details without writes', async () => {
    const row = booking();
    const before = JSON.stringify(row);
    mockPopulate.mockResolvedValue(row);
    const response = await POST(
      request({ bookingId, totalPrice: 1, email: 'other@example.com' })
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ id: 'message' });
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        from: 'LodgeFlow <payments@lodgeflow.app>',
        to: 'first@example.com',
        subject: 'Experience Booking Confirmation - LodgeFlow',
      })
    );
    for (const text of [
      'Get ready for an adventure, Avery!',
      'Booking ID:#994390AB',
      'Experience:Guided Kayak',
      'Date:Monday, June 3, 2030',
      'Time:15:00',
      'Participants:2',
      'Duration:2 hours',
      'Location:North dock',
      '$37.50 x 2 participants:',
      '$75.00',
      'Guide',
      'Safety gear',
      'Water',
      'Sunscreen',
    ])
      expect(emailText()).toContain(text);
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(JSON.stringify(row)).toBe(before);
  });

  test('free bookings use notification sender, Guest fallback and optional sections remain absent', async () => {
    mockPopulate.mockResolvedValue(
      booking({
        totalPrice: 0,
        isPaid: false,
        numParticipants: 1,
        timeSlot: undefined,
        experience: {
          ...experience(),
          price: 0,
          includes: [],
          whatToBring: [],
          location: undefined,
        },
      })
    );
    mockCurrentUser.mockResolvedValue({
      emailAddresses: [{ emailAddress: 'guest@example.com' }],
    });
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        from: 'LodgeFlow <notifications@lodgeflow.app>',
      })
    );
    expect(emailText()).toContain('Get ready for an adventure, Guest!');
    expect(emailText()).toContain('$0.00 x 1 participant:');
    for (const text of [
      'Time:',
      'Location:',
      "What's Included",
      'What to Bring',
    ])
      expect(emailText()).not.toContain(text);
  });

  test.each([
    { totalPrice: 75, variable: 'LODGEFLOW_PAYMENT_EMAIL_FROM' },
    { totalPrice: 0, variable: 'LODGEFLOW_NOTIFICATION_EMAIL_FROM' },
  ])(
    'honors the sender override for $totalPrice',
    async ({ totalPrice, variable }) => {
      process.env[variable] = 'receipts@example.com';
      mockPopulate.mockResolvedValue(booking({ totalPrice }));
      expect((await POST(request())).status).toBe(200);
      expect(mockSend.mock.calls[0][0].from).toBe(
        'LodgeFlow <receipts@example.com>'
      );
    }
  );

  test('authentication and missing ID deny before database access', async () => {
    mockAuth.mockResolvedValueOnce({ userId: null });
    let response = await POST(request());
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: 'Authentication required' });
    response = await POST(request({}));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'Booking ID is required' });
    expect(mockConnect).not.toHaveBeenCalled();
    expect(mockSend).not.toHaveBeenCalled();
  });

  test.each([
    { row: null, status: 404, error: 'Booking not found' },
    {
      row: booking({ customer: 'foreign' }),
      status: 403,
      error: 'Not authorized to send this confirmation',
    },
    {
      row: booking({ isPaid: false }),
      status: 409,
      error: 'Payment is required before confirmation',
    },
    {
      row: booking({ customer: 'foreign', experience: null }),
      status: 403,
      error: 'Not authorized to send this confirmation',
    },
    {
      row: booking({ isPaid: false, experience: null }),
      status: 409,
      error: 'Payment is required before confirmation',
    },
  ])('preserves manual denial: $error', async ({ row, status, error }) => {
    mockPopulate.mockResolvedValue(row);
    const response = await POST(request());
    expect(response.status).toBe(status);
    expect(await response.json()).toEqual({ error });
    expect(mockCurrentUser).not.toHaveBeenCalled();
    expect(mockSend).not.toHaveBeenCalled();
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  test.each([
    { emailAddresses: [] },
    { emailAddresses: [{ emailAddress: 'invalid' }] },
  ])('rejects unusable recipient %j', async ({ emailAddresses }) => {
    mockCurrentUser.mockResolvedValue({ emailAddresses });
    const response = await POST(request());
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'Invalid email address' });
    expect(mockSend).not.toHaveBeenCalled();
  });

  test('manual provider failure returns the legacy envelope, allows retry and never marks delivery', async () => {
    mockSend.mockResolvedValueOnce({
      data: null,
      error: { message: 'Provider unavailable' },
    });
    const response = await POST(request());
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: { message: 'Provider unavailable' },
    });
    expect((await POST(request())).status).toBe(200);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  test('settlement uses the primary recipient, stable retry key, rendered fields and delivery marker', async () => {
    await sendReservationConfirmation({ kind: 'experience', id: bookingId });
    expect(mockGetUser).toHaveBeenCalledWith('customer');
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'primary@example.com',
        from: 'LodgeFlow <payments@lodgeflow.app>',
        subject: 'Experience Booking Confirmation - LodgeFlow',
      }),
      { idempotencyKey: `reservation-confirmation:experience:${bookingId}` }
    );
    expect(emailText()).toContain('Experience:Guided Kayak');
    expect(emailText()).toContain('$75.00');
    expect(mockUpdate).toHaveBeenCalledWith(
      { _id: bookingId },
      {
        $set: { paymentConfirmationSentAt: expect.any(Date) },
        $inc: { __v: 1 },
      }
    );
  });

  test.each([
    null,
    booking({ isPaid: false }),
    booking({ status: 'cancelled' }),
    booking({ paymentConfirmationSentAt: new Date() }),
  ])('skips ineligible settlement confirmations: %j', async row => {
    mockPopulate.mockResolvedValue(row);
    await sendReservationConfirmation({ kind: 'experience', id: bookingId });
    expect(mockGetUser).not.toHaveBeenCalled();
    expect(mockSend).not.toHaveBeenCalled();
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  test('settlement falls back to the first recipient and Guest', async () => {
    mockGetUser.mockResolvedValue({
      emailAddresses: [{ id: 'first', emailAddress: 'first@example.com' }],
    });
    await sendReservationConfirmation({ kind: 'experience', id: bookingId });
    expect(mockSend.mock.calls[0][0].to).toBe('first@example.com');
    expect(emailText()).toContain('Get ready for an adventure, Guest!');
  });

  test('settlement failures remain retryable without marking delivery', async () => {
    mockSend.mockResolvedValueOnce({
      data: null,
      error: { message: 'Provider unavailable' },
    });
    await expect(
      sendReservationConfirmation({ kind: 'experience', id: bookingId })
    ).rejects.toThrow('Provider unavailable');
    expect(mockUpdate).not.toHaveBeenCalled();
    await sendReservationConfirmation({ kind: 'experience', id: bookingId });
    expect(mockUpdate).toHaveBeenCalledTimes(1);
    expect(mockSend.mock.calls[1][1]).toEqual(mockSend.mock.calls[0][1]);
  });

  test('missing experience after settlement remains a retryable failure without send or marker', async () => {
    mockPopulate.mockResolvedValue(booking({ experience: null }));
    await expect(
      sendReservationConfirmation({ kind: 'experience', id: bookingId })
    ).rejects.toThrow();
    expect(mockSend).not.toHaveBeenCalled();
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  test('the shared helper preserves dining rendering and its delivery marker', async () => {
    mockDiningPopulate.mockResolvedValue({
      customer: 'customer',
      isPaid: true,
      status: 'confirmed',
      date: new Date('2030-06-03T15:00:00Z'),
      dining: {
        name: 'Dinner',
        price: 30,
        mealType: 'dinner',
        servingTime: { start: '17:00', end: '21:00' },
        location: 'Lodge',
      },
      time: '18:00',
      numGuests: 2,
      totalPrice: 60,
      occasion: 'Birthday',
      tablePreference: 'outdoor',
    });
    await sendReservationConfirmation({ kind: 'dining', id: bookingId });
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'primary@example.com',
        from: 'LodgeFlow <payments@lodgeflow.app>',
        subject: 'Dining Reservation Confirmation - LodgeFlow',
      }),
      { idempotencyKey: `reservation-confirmation:dining:${bookingId}` }
    );
    for (const value of ['Dinner', '18:00', 'Birthday', '$60.00'])
      expect(emailText()).toContain(value);
    expect(mockDiningUpdate).toHaveBeenCalledTimes(1);
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});

test('missing experience regression: manual confirmation returns a clear 404 without sending', async () => {
  mockPopulate.mockResolvedValue(booking({ experience: null }));
  const response = await POST(request());
  expect(response.status).toBe(404);
  expect(await response.json()).toEqual({ error: 'Experience not found' });
  expect(mockSend).not.toHaveBeenCalled();
  expect(mockUpdate).not.toHaveBeenCalled();
});
