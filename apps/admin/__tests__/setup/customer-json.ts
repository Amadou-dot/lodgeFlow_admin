import type { CustomerJson } from '@/types/customer-json';

export const customerJsonFixture: CustomerJson = {
  id: 'user_guest',
  username: null,
  first_name: null,
  last_name: null,
  name: 'Guest',
  email: '',
  image_url: '',
  has_image: false,
  created_at: '2030-01-01T00:00:00.000Z',
  updated_at: '2030-02-01T00:00:00.000Z',
  last_sign_in_at: null,
  last_active_at: '2030-03-01T00:00:00.000Z',
  banned: false,
  locked: false,
  lockout_expires_in_seconds: null,
  totalBookings: 0,
  totalSpent: 0,
  loyaltyTier: 'Bronze',
};
