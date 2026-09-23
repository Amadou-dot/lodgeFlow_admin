/** @jest-environment node */
import { Types } from 'mongoose';
import Booking from '@lodgeflow/database/models/Booking';
import Cabin from '@lodgeflow/database/models/Cabin';
import {
  serializeBookingEmailBooking,
  serializeBookingEmailCabin,
} from '@/lib/serializers/booking-email';

test('serializes only rendered booking fields from a hydrated document, with string IDs and unchanged instants/amounts', () => {
  const booking = new Booking({
    _id: new Types.ObjectId('507f1f77bcf86cd7994390ab'),
    customer: 'private-customer',
    cabin: new Types.ObjectId(),
    checkInDate: new Date('2030-06-03T09:00:00-06:00'),
    checkOutDate: new Date('2030-06-05T09:00:00-06:00'),
    numNights: 2,
    numGuests: 3,
    cabinPrice: 125.25,
    extrasPrice: 50.25,
    totalPrice: 300.75,
    depositAmount: 75,
    remainingAmount: 200.75,
    extras: {
      hasBreakfast: true,
      breakfastPrice: 50.25,
      hasPets: false,
      petFee: 20,
      hasParking: false,
      parkingFee: 12,
      hasEarlyCheckIn: false,
      earlyCheckInFee: 7,
      hasLateCheckOut: false,
      lateCheckOutFee: 9,
    },
    observations: 'private-note',
    checkoutToken: 'private-quote',
  });
  const serialized = serializeBookingEmailBooking(booking);
  expect(serialized).toEqual({
    _id: '507f1f77bcf86cd7994390ab',
    checkInDate: '2030-06-03T15:00:00.000Z',
    checkOutDate: '2030-06-05T15:00:00.000Z',
    numNights: 2,
    numGuests: 3,
    cabinSubtotal: 250.5,
    extrasPrice: 50.25,
    totalPrice: 300.75,
    depositAmount: 75,
    remainingAmount: 200.75,
    extras: {
      hasBreakfast: true,
      breakfastPrice: 50.25,
      hasPets: false,
      petFee: 20,
      hasParking: false,
      parkingFee: 12,
      hasEarlyCheckIn: false,
      earlyCheckInFee: 7,
      hasLateCheckOut: false,
      lateCheckOutFee: 9,
    },
  });
  expect(JSON.parse(JSON.stringify(serialized))).toEqual(serialized);
  booking.extras.breakfastPrice = 99;
  expect(serialized.extras.breakfastPrice).toBe(50.25);
});

test('serializes hydrated legacy defaults without requiring document methods in template inputs', () => {
  const booking = Booking.hydrate({
    _id: new Types.ObjectId(),
    checkInDate: new Date('2030-06-03T15:00:00Z'),
    checkOutDate: new Date('2030-06-05T15:00:00Z'),
    numNights: 2,
    numGuests: 1,
    cabinPrice: 150,
    totalPrice: 150,
    remainingAmount: 150,
  });
  const serialized = serializeBookingEmailBooking(booking);
  expect(serialized.extras).toEqual({
    hasBreakfast: false,
    breakfastPrice: 0,
    hasPets: false,
    petFee: 0,
    hasParking: false,
    parkingFee: 0,
    hasEarlyCheckIn: false,
    earlyCheckInFee: 0,
    hasLateCheckOut: false,
    lateCheckOutFee: 0,
  });
  expect(serialized.extrasPrice).toBe(0);
  expect(serialized.depositAmount).toBe(0);
  expect(serialized.remainingAmount).toBe(150);
  expect(serialized.cabinSubtotal).toBe(150);
});

test('copies only rendered cabin fields and detaches amenities from the document', () => {
  const cabin = new Cabin({
    name: 'Pine Cabin',
    capacity: 4,
    price: 125.25,
    description: 'A quiet retreat beside the lake.',
    amenities: ['Fireplace', 'Kitchen'],
    image: 'https://example.com/cabin.jpg',
    status: 'active',
    discount: 10,
  });
  const serialized = serializeBookingEmailCabin(cabin);
  expect(serialized).toEqual({
    name: 'Pine Cabin',
    capacity: 4,
    price: 125.25,
    description: 'A quiet retreat beside the lake.',
    amenities: ['Fireplace', 'Kitchen'],
  });
  cabin.amenities.push('Sauna');
  expect(serialized.amenities).toEqual(['Fireplace', 'Kitchen']);
  expect(
    serializeBookingEmailCabin(new Cabin({ name: 'Sparse cabin' })).amenities
  ).toEqual([]);
});
