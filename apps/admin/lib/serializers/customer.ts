import type { Customer } from '@/types/clerk';
import type { CustomerJson } from '@/types/customer-json';
import type { BookingCustomer } from '@/types/booking-read';

export type CustomerSource = Pick<Customer, 'id' | 'name' | 'email'> &
  Partial<Customer>;

export function serializeCustomerFields(
  customer: CustomerSource
): BookingCustomer {
  return {
    id: customer.id,
    username: customer.username,
    first_name: customer.first_name,
    last_name: customer.last_name,
    name: customer.name,
    email: customer.email,
    phone: customer.phone,
    image_url: customer.image_url,
    has_image: customer.has_image,
    banned: customer.banned,
    locked: customer.locked,
    lockout_expires_in_seconds: customer.lockout_expires_in_seconds,
    nationality: customer.nationality,
    nationalId: customer.nationalId,
    address: customer.address,
    emergencyContact: customer.emergencyContact,
    preferences: customer.preferences,
    totalBookings: customer.totalBookings,
    totalSpent: customer.totalSpent,
    loyaltyTier: customer.loyaltyTier,
    fullAddress: customer.fullAddress,
    created_at: customer.created_at?.toISOString(),
    updated_at: customer.updated_at?.toISOString(),
    last_sign_in_at:
      customer.last_sign_in_at == null
        ? customer.last_sign_in_at
        : customer.last_sign_in_at.toISOString(),
    last_active_at: customer.last_active_at?.toISOString(),
    lastBookingDate: customer.lastBookingDate?.toISOString(),
    recentBookings: customer.recentBookings?.map(booking => ({ ...booking })),
  };
}

export function serializeCustomer(customer: Customer): CustomerJson {
  return {
    ...serializeCustomerFields(customer),
    id: customer.id,
    username: customer.username,
    first_name: customer.first_name,
    last_name: customer.last_name,
    name: customer.name,
    email: customer.email,
    image_url: customer.image_url,
    has_image: customer.has_image,
    created_at: customer.created_at.toISOString(),
    updated_at: customer.updated_at.toISOString(),
    last_sign_in_at:
      customer.last_sign_in_at === null
        ? null
        : customer.last_sign_in_at.toISOString(),
    last_active_at: customer.last_active_at.toISOString(),
    banned: customer.banned,
    locked: customer.locked,
    lockout_expires_in_seconds: customer.lockout_expires_in_seconds,
    totalBookings: customer.totalBookings,
    totalSpent: customer.totalSpent,
    loyaltyTier: customer.loyaltyTier,
  };
}
