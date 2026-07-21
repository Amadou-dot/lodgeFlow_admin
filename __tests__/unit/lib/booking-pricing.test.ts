import { calculateBookingPricing } from '@/lib/booking-pricing';

const baseCabin = { price: 200, discount: 0, extraGuestFee: 0 };
const baseSettings = {
  breakfastPrice: 15,
  petFee: 25,
  parkingFee: 10,
  parkingIncluded: false,
  earlyCheckInFee: 20,
  lateCheckOutFee: 20,
};

describe('calculateBookingPricing', () => {
  it('computes numNights from the check-in/check-out range', () => {
    const result = calculateBookingPricing({
      cabin: baseCabin,
      settings: baseSettings,
      checkInDate: new Date('2027-08-01'),
      checkOutDate: new Date('2027-08-05'),
      numGuests: 2,
    });

    expect(result.numNights).toBe(4);
  });

  it('prices the cabin per night using the discounted price', () => {
    const result = calculateBookingPricing({
      cabin: { price: 200, discount: 50, extraGuestFee: 0 },
      settings: baseSettings,
      checkInDate: new Date('2027-08-01'),
      checkOutDate: new Date('2027-08-05'),
      numGuests: 2,
    });

    expect(result.cabinPrice).toBe(150);
    expect(result.totalPrice).toBe(150 * 4);
  });

  it('ignores a zero discount and uses the full cabin price', () => {
    const result = calculateBookingPricing({
      cabin: { price: 200, discount: 0, extraGuestFee: 0 },
      settings: baseSettings,
      checkInDate: new Date('2027-08-01'),
      checkOutDate: new Date('2027-08-05'),
      numGuests: 2,
    });

    expect(result.cabinPrice).toBe(200);
  });

  it('ignores a negative discount and uses the full cabin price', () => {
    const result = calculateBookingPricing({
      cabin: { price: 200, discount: -10, extraGuestFee: 0 },
      settings: baseSettings,
      checkInDate: new Date('2027-08-01'),
      checkOutDate: new Date('2027-08-05'),
      numGuests: 2,
    });

    expect(result.cabinPrice).toBe(200);
  });

  it('throws when checkOutDate is not after checkInDate', () => {
    expect(() =>
      calculateBookingPricing({
        cabin: baseCabin,
        settings: baseSettings,
        checkInDate: new Date('2027-08-05'),
        checkOutDate: new Date('2027-08-05'),
        numGuests: 2,
      })
    ).toThrow(/checkOutDate/);
  });

  it('throws when numGuests is less than 1', () => {
    expect(() =>
      calculateBookingPricing({
        cabin: baseCabin,
        settings: baseSettings,
        checkInDate: new Date('2027-08-01'),
        checkOutDate: new Date('2027-08-05'),
        numGuests: 0,
      })
    ).toThrow(/numGuests/);
  });

  it('returns zero extras pricing and totalPrice equal to cabinPrice*nights when no extras are selected', () => {
    const result = calculateBookingPricing({
      cabin: baseCabin,
      settings: baseSettings,
      checkInDate: new Date('2027-08-01'),
      checkOutDate: new Date('2027-08-05'),
      numGuests: 2,
    });

    expect(result.extrasPrice).toBe(0);
    expect(result.totalPrice).toBe(800);
    expect(result.extras).toEqual({
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
  });

  it('prices breakfast per guest per night', () => {
    const result = calculateBookingPricing({
      cabin: baseCabin,
      settings: baseSettings,
      checkInDate: new Date('2027-08-01'),
      checkOutDate: new Date('2027-08-05'), // 4 nights
      numGuests: 3,
      extras: { hasBreakfast: true },
    });

    expect(result.extras.breakfastPrice).toBe(15 * 3 * 4);
    expect(result.extrasPrice).toBe(15 * 3 * 4);
  });

  it('prices the pet fee per night', () => {
    const result = calculateBookingPricing({
      cabin: baseCabin,
      settings: baseSettings,
      checkInDate: new Date('2027-08-01'),
      checkOutDate: new Date('2027-08-05'), // 4 nights
      numGuests: 2,
      extras: { hasPets: true },
    });

    expect(result.extras.petFee).toBe(25 * 4);
  });

  it('prices the parking fee per night only when parking is not already included', () => {
    const withoutIncluded = calculateBookingPricing({
      cabin: baseCabin,
      settings: { ...baseSettings, parkingIncluded: false },
      checkInDate: new Date('2027-08-01'),
      checkOutDate: new Date('2027-08-05'), // 4 nights
      numGuests: 2,
      extras: { hasParking: true },
    });
    expect(withoutIncluded.extras.parkingFee).toBe(10 * 4);

    const withIncluded = calculateBookingPricing({
      cabin: baseCabin,
      settings: { ...baseSettings, parkingIncluded: true },
      checkInDate: new Date('2027-08-01'),
      checkOutDate: new Date('2027-08-05'),
      numGuests: 2,
      extras: { hasParking: true },
    });
    expect(withIncluded.extras.parkingFee).toBe(0);
  });

  it('charges flat early check-in and late check-out fees regardless of stay length', () => {
    const result = calculateBookingPricing({
      cabin: baseCabin,
      settings: baseSettings,
      checkInDate: new Date('2027-08-01'),
      checkOutDate: new Date('2027-08-10'), // 9 nights
      numGuests: 2,
      extras: { hasEarlyCheckIn: true, hasLateCheckOut: true },
    });

    expect(result.extras.earlyCheckInFee).toBe(20);
    expect(result.extras.lateCheckOutFee).toBe(20);
  });

  it('charges an extra-guest fee per additional guest per night when the cabin has one', () => {
    const result = calculateBookingPricing({
      cabin: { price: 200, discount: 0, extraGuestFee: 30 },
      settings: baseSettings,
      checkInDate: new Date('2027-08-01'),
      checkOutDate: new Date('2027-08-05'), // 4 nights
      numGuests: 3, // 2 extra guests beyond the first
      extras: {},
    });

    expect(result.extrasPrice).toBe(30 * 2 * 4);
  });

  it('charges no extra-guest fee for a single guest even when the cabin has one configured', () => {
    const result = calculateBookingPricing({
      cabin: { price: 200, discount: 0, extraGuestFee: 30 },
      settings: baseSettings,
      checkInDate: new Date('2027-08-01'),
      checkOutDate: new Date('2027-08-05'),
      numGuests: 1,
      extras: {},
    });

    expect(result.extrasPrice).toBe(0);
  });

  it('sums cabinPrice*nights and all extras into totalPrice', () => {
    const result = calculateBookingPricing({
      cabin: { price: 200, discount: 20, extraGuestFee: 10 },
      settings: baseSettings,
      checkInDate: new Date('2027-08-01'),
      checkOutDate: new Date('2027-08-04'), // 3 nights
      numGuests: 2,
      extras: { hasBreakfast: true, hasPets: true },
    });

    const expectedCabinPrice = 180; // 200 - 20
    const expectedExtraGuestFee = 10 * 1 * 3;
    const expectedBreakfast = 15 * 2 * 3;
    const expectedPetFee = 25 * 3;
    const expectedExtrasPrice =
      expectedExtraGuestFee + expectedBreakfast + expectedPetFee;

    expect(result.cabinPrice).toBe(expectedCabinPrice);
    expect(result.extrasPrice).toBe(expectedExtrasPrice);
    expect(result.totalPrice).toBe(
      expectedCabinPrice * 3 + expectedExtrasPrice
    );
  });

  it('ignores any client-supplied fee values on the extras selection', () => {
    const result = calculateBookingPricing({
      cabin: baseCabin,
      settings: baseSettings,
      checkInDate: new Date('2027-08-01'),
      checkOutDate: new Date('2027-08-05'),
      numGuests: 2,
      extras: {
        hasBreakfast: true,
        // @ts-expect-error - simulating a tampered client payload
        breakfastPrice: 999999,
      },
    });

    expect(result.extras.breakfastPrice).toBe(15 * 2 * 4);
  });
});
