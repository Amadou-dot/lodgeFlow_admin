import { NextRequest } from 'next/server';
import { Booking, Cabin } from '@lodgeflow/database';
import { GET as dashboard } from '@/app/api/dashboard/route';
import { GET as bookings } from '@/app/api/bookings/route';
import { GET as reservations } from '@/app/api/reservations/route';
import { getClerkUsersBatch } from '@/lib/clerk-users';
import type { Customer } from '@/types/clerk';

jest.mock('@/lib/mongodb', () => jest.fn().mockResolvedValue(undefined));
jest.mock('@clerk/nextjs/server', () => ({
  clerkClient: jest.fn().mockResolvedValue({
    users: { getCount: jest.fn().mockResolvedValue(1) },
  }),
}));

const customer: Customer = {
  id: 'user_production_guest',
  name: 'Avery Guest',
  email: 'avery@example.invalid',
  username: null,
  first_name: 'Avery',
  last_name: 'Guest',
  image_url: '',
  has_image: false,
  created_at: new Date('2026-01-01'),
  updated_at: new Date('2026-01-01'),
  last_sign_in_at: null,
  last_active_at: new Date('2026-01-01'),
  banned: false,
  locked: false,
  lockout_expires_in_seconds: null,
  totalBookings: 0,
  totalSpent: 0,
  loyaltyTier: 'Bronze',
};

test.each([
  { kind: 'available', expectedName: 'Avery Guest', errors: 0 },
  { kind: 'missing', expectedName: 'Unavailable guest', errors: 0 },
  { kind: 'transient failure', expectedName: 'Unavailable guest', errors: 1 },
])(
  'all three staff reads display the same guest for a $kind lookup',
  async ({ kind, expectedName, errors }) => {
    const cabin = await Cabin.create({
      name: 'Pine Cabin',
      description: 'Guest display test cabin',
      image: 'https://example.invalid/cabin.jpg',
      capacity: 4,
      price: 200,
      discount: 0,
      amenities: ['WiFi'],
    });
    const booking = await Booking.create({
      cabin: cabin._id,
      customer: customer.id,
      checkInDate: new Date('2040-06-01'),
      checkOutDate: new Date('2040-06-03'),
      numNights: 2,
      numGuests: 2,
      cabinPrice: 400,
      totalPrice: 400,
      status: 'confirmed',
    });
    jest.mocked(getClerkUsersBatch).mockResolvedValue({
      users: new Map([[customer.id, kind === 'available' ? customer : null]]),
      errors,
    });

    const dashboardResponse = await dashboard();
    expect(dashboardResponse.status).toBe(200);
    const dashboardBody = await dashboardResponse.json();
    expect(dashboardBody.data.recentActivity).toEqual([
      expect.objectContaining({
        id: String(booking._id),
        customerName: expectedName,
      }),
    ]);

    const bookingsResponse = await bookings(
      new NextRequest('https://admin.test/api/bookings')
    );
    expect(bookingsResponse.status).toBe(200);
    const bookingsBody = await bookingsResponse.json();
    expect(bookingsBody.data).toEqual([
      expect.objectContaining({
        id: String(booking._id),
        customer: expect.objectContaining({
          id: customer.id,
          name: expectedName,
        }),
        guest: expect.objectContaining({ id: customer.id, name: expectedName }),
      }),
    ]);
    expect(bookingsBody._clerkWarning).toBe(
      errors
        ? 'Failed to fetch 1 customer record(s) from Clerk. Some customer data may be unavailable.'
        : undefined
    );

    const reservationsResponse = await reservations(
      new Request('https://admin.test/api/reservations')
    );
    expect(reservationsResponse.status).toBe(200);
    const reservationsBody = await reservationsResponse.json();
    expect(reservationsBody.data.rows).toEqual([
      expect.objectContaining({
        _id: String(booking._id),
        customer: customer.id,
        customerName: expectedName,
      }),
    ]);
  }
);
