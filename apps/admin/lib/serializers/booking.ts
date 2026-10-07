import type { IBooking } from '@lodgeflow/database/models/Booking';
import {
  serializeBookingFields,
  type BookingReadSource,
} from '@lodgeflow/database/booking-json';
import type { CabinDetailSource } from '@lodgeflow/database/cabin-json';
import { serializeCustomerFields, type CustomerSource } from './customer';
import type {
  AdminBooking,
  BookingCabin,
  RecentCustomerBooking,
} from '@/types/booking-read';

export type AdminBookingCabinSource = Pick<
  CabinDetailSource,
  '_id' | 'name' | 'image' | 'capacity' | 'price'
> &
  Partial<CabinDetailSource>;
export type AdminBookingSource = BookingReadSource &
  Pick<
    IBooking,
    | 'extrasPrice'
    | 'isPaid'
    | 'amountPaid'
    | 'depositPaid'
    | 'depositAmount'
    | 'remainingAmount'
  > & {
    cabin: AdminBookingCabinSource | null;
    durationText?: string;
    paymentStatus?: 'paid' | 'partial' | 'unpaid';
  };
function serializeCabin(cabin: AdminBookingCabinSource): BookingCabin {
  return {
    _id: cabin._id.toHexString(),
    id: cabin._id.toHexString(),
    name: cabin.name,
    image: cabin.image,
    capacity: cabin.capacity,
    price: cabin.price,
    discount: cabin.discount,
    description: cabin.description,
    status: cabin.status,
    images: cabin.images == null ? cabin.images : [...cabin.images],
    amenities: cabin.amenities == null ? cabin.amenities : [...cabin.amenities],
    bedrooms: cabin.bedrooms,
    bathrooms: cabin.bathrooms,
    size: cabin.size,
    minNights: cabin.minNights,
    extraGuestFee: cabin.extraGuestFee,
    discountedPrice: cabin.discountedPrice,
    createdAt:
      cabin.createdAt == null ? cabin.createdAt : cabin.createdAt.toISOString(),
    updatedAt:
      cabin.updatedAt == null ? cabin.updatedAt : cabin.updatedAt.toISOString(),
    __v: cabin.__v,
  };
}

export function serializeAdminBooking({
  booking,
  customer,
}: {
  booking: AdminBookingSource;
  customer: CustomerSource | null;
}): AdminBooking {
  const customerJson =
    customer === null ? null : serializeCustomerFields(customer);
  return {
    ...serializeRecentCustomerBooking(booking),
    cabinName: booking.cabin?.name,
    customer: customerJson,
    guest: customerJson,
  };
}

export function serializeRecentCustomerBooking(
  booking: AdminBookingSource
): RecentCustomerBooking {
  const fields = serializeBookingFields(booking);
  return {
    ...fields,
    extrasPrice: booking.extrasPrice,
    isPaid: booking.isPaid,
    amountPaid: booking.amountPaid,
    depositPaid: booking.depositPaid,
    depositAmount: booking.depositAmount,
    remainingAmount: booking.remainingAmount,
    id: fields._id,
    durationText: booking.durationText,
    paymentStatus: booking.paymentStatus,
    cabin: booking.cabin === null ? null : serializeCabin(booking.cabin),
  };
}
