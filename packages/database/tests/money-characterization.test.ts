import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  BookingPricingError,
  calculateBookingPricing,
  calculateDepositAmount,
} from '../src/booking-pricing';
import {
  BookingPaymentError,
  roundMoney,
  paymentSummary,
  addBookingPayment,
} from '../src/booking-payments';
import Booking from '../src/models/Booking';
import { reservationPaymentSummary } from '../src/reservation-payment-state';

test('cabin prices keep sub-cent arithmetic while deposit obligations round to whole units', () => {
  const result = calculateBookingPricing({
    cabin: { price: 100.005, discount: 0.001, extraGuestFee: 0.105 },
    settings: {
      breakfastPrice: 0.335,
      petFee: 0,
      parkingFee: 0,
      parkingIncluded: false,
      earlyCheckInFee: 0,
      lateCheckOutFee: 0,
    },
    checkInDate: new Date('2030-06-01'),
    checkOutDate: new Date('2030-06-04'),
    numGuests: 2,
    extras: { hasBreakfast: true },
  });
  assert.equal(result.cabinPrice, 100.005 - 0.001);
  assert.equal(result.extrasPrice, 0.335 * 2 * 3 + 0.105 * 3);
  assert.equal(
    result.totalPrice,
    (100.005 - 0.001) * 3 + (0.335 * 2 * 3 + 0.105 * 3)
  );
  assert.equal(
    calculateDepositAmount({
      settings: { requireDeposit: true, depositPercentage: 25 },
      totalPrice: 102,
    }),
    26
  );
  assert.equal(
    calculateDepositAmount({
      settings: { requireDeposit: true, depositPercentage: 200 },
      totalPrice: 1.25,
    }),
    1.25
  );
  assert.equal(
    calculateDepositAmount({
      settings: { requireDeposit: true, depositPercentage: -10 },
      totalPrice: 100,
    }),
    0
  );
});

test('cabin receipt rounding is epsilon-assisted and reservation total conversion is not', () => {
  assert.equal(roundMoney(1.005), 1.01);
  assert.equal(roundMoney(-1.005), -1);
  assert.equal(
    paymentSummary({
      totalPrice: 2.005,
      depositAmount: 0,
      payments: [{ amount: 1 }],
    }).remainingAmount,
    1.01
  );
  assert.equal(
    reservationPaymentSummary({
      totalPrice: 1.005,
      receipts: [],
      isPaid: false,
    }).totalCents,
    100
  );
});

test('invalid monetary values cannot become booking pricing or payment state', () => {
  for (const totalPrice of [NaN, Infinity, -1, Number.MAX_SAFE_INTEGER]) {
    assert.throws(
      () =>
        calculateDepositAmount({
          settings: { requireDeposit: true, depositPercentage: 25 },
          totalPrice,
        }),
      BookingPricingError
    );
    assert.throws(
      () => paymentSummary({ totalPrice, depositAmount: 0, payments: [] }),
      BookingPaymentError
    );
  }
  assert.throws(
    () =>
      calculateBookingPricing({
        cabin: { price: Infinity, discount: 0 },
        settings: {
          breakfastPrice: 0,
          petFee: 0,
          parkingFee: 0,
          parkingIncluded: false,
          earlyCheckInFee: 0,
          lateCheckOutFee: 0,
        },
        checkInDate: new Date('2030-06-01'),
        checkOutDate: new Date('2030-06-02'),
        numGuests: 1,
      }),
    BookingPricingError
  );
});

test('unsafe or sub-cent receipts leave loaded booking state untouched', () => {
  const booking = new Booking({
    totalPrice: 1e14,
    depositAmount: 0,
    status: 'confirmed',
    payments: [],
  });
  for (const amount of [NaN, Infinity, -1, 0, 0.001, 1e14]) {
    assert.throws(
      () =>
        addBookingPayment(booking, {
          id: 'invalid',
          amount,
          method: 'cash',
          receivedAt: new Date('2030-06-01'),
        }),
      BookingPaymentError
    );
    assert.equal(booking.payments.length, 0);
  }
});

test('supported large major amounts retain legacy rounding and deposit clamping', () => {
  const totalPrice = 90071992547409.9;
  assert.equal(roundMoney(totalPrice), totalPrice);
  assert.equal(
    paymentSummary({ totalPrice, depositAmount: 0, payments: [] })
      .remainingAmount,
    totalPrice
  );
  assert.equal(
    calculateDepositAmount({
      settings: { requireDeposit: true, depositPercentage: 100 },
      totalPrice,
    }),
    totalPrice
  );
});

test('whole deposits may clamp to an existing sub-cent total without rounding it again', () => {
  for (const totalPrice of [0.995, 1.555]) {
    assert.equal(
      calculateDepositAmount({
        settings: { requireDeposit: true, depositPercentage: 100 },
        totalPrice,
      }),
      totalPrice
    );
  }
});
