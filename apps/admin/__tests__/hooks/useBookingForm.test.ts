import { act, renderHook } from '@testing-library/react';
import { useBookingForm } from '@/hooks/useBookingForm';
import { createBookingSchema } from '@/lib/validations/booking';
import type { Cabin, Settings } from '@/types';
const mockCabins: Cabin[] = [
  {
    _id: '507f1f77bcf86cd799439011',
    id: '507f1f77bcf86cd799439011',
    name: 'Pine',
    image: 'https://example.com/pine.jpg',
    images: [],
    capacity: 4,
    price: 1.005,
    discount: 0,
    description: 'Quiet cabin',
    amenities: [],
    status: 'active',
  },
];
const settings: Settings = {
  _id: 'settings',
  id: 'settings',
  singleton: 'global',
  fullAddress: '',
  minBookingLength: 1,
  maxBookingLength: 30,
  maxGuestsPerBooking: 8,
  breakfastPrice: 2.5,
  checkInTime: '15:00',
  checkOutTime: '11:00',
  cancellationPolicy: 'moderate',
  requireDeposit: true,
  depositPercentage: 50,
  allowPets: true,
  petFee: 2,
  smokingAllowed: false,
  earlyCheckInFee: 3,
  lateCheckOutFee: 4,
  wifiIncluded: true,
  parkingIncluded: false,
  parkingFee: 1,
  currency: 'EUR',
  timezone: 'UTC',
  businessHours: { open: '09:00', close: '17:00', daysOpen: [] },
  notifications: {
    emailEnabled: true,
    smsEnabled: false,
    bookingConfirmation: true,
    paymentReminders: true,
    checkInReminders: true,
  },
};
let mockSettings: Settings | undefined;
beforeEach(() => {
  mockSettings = undefined;
});
jest.mock('@/hooks/useCabins', () => ({
  useCabins: () => ({ data: mockCabins }),
}));
jest.mock('@/hooks/useSettings', () => ({
  useSettings: () => ({ data: mockSettings }),
}));
jest.mock('@/hooks/useInfiniteCustomers', () => ({
  useInfiniteCustomers: () => ({
    customers: [],
    hasMore: false,
    isLoading: false,
    onLoadMore: jest.fn(),
    searchCustomers: jest.fn(),
  }),
}));
jest.mock('@heroui/use-infinite-scroll', () => ({
  useInfiniteScroll: () => [null, null],
}));
test('form selections produce an accepted request without forged pricing or payment flags', () => {
  const { result } = renderHook(() => useBookingForm());
  act(() => {
    result.current.handleInputChange('cabin', '507f1f77bcf86cd799439011');
    result.current.handleInputChange('customer', 'user_guest');
    result.current.handleInputChange('checkInDate', '2040-01-01');
    result.current.handleInputChange('checkOutDate', '2040-01-03');
    result.current.handleInputChange('hasBreakfast', true);
    result.current.handleInputChange('paymentMethod', 'cash');
    result.current.handleInputChange('isPaid', true);
    result.current.handleInputChange('depositPaid', true);
  });
  const request = result.current.buildBookingData();
  expect(
    createBookingSchema.safeParse(JSON.parse(JSON.stringify(request))).success
  ).toBe(true);
  expect(request.extras?.hasBreakfast).toBe(true);
  expect(request.checkInDate).toBe('2040-01-01T00:00:00.000Z');
  expect(request.paymentMethod).toBe('cash');
  expect(request).not.toHaveProperty('isPaid');
  expect(request).not.toHaveProperty('totalPrice');
  expect(request.extras).not.toHaveProperty('breakfastPrice');
});

test('preview preserves fractional cabin arithmetic and rounds only the deposit to whole major units', () => {
  mockSettings = settings;
  const { result } = renderHook(() => useBookingForm());
  act(() => {
    result.current.handleInputChange('cabin', mockCabins[0]._id);
    result.current.handleInputChange('checkInDate', '2040-01-01');
    result.current.handleInputChange('checkOutDate', '2040-01-04');
    result.current.handleInputChange('numGuests', 2);
    result.current.handleInputChange('hasBreakfast', true);
    result.current.handleInputChange('hasPets', true);
    result.current.handleInputChange('hasParking', true);
    result.current.handleInputChange('hasEarlyCheckIn', true);
    result.current.handleInputChange('hasLateCheckOut', true);
  });
  expect(result.current.priceBreakdown.cabinPrice).toBeCloseTo(3.015, 10);
  expect(result.current.priceBreakdown).toMatchObject({
    breakfastPrice: 15,
    petFee: 6,
    parkingFee: 3,
    earlyCheckInFee: 3,
    lateCheckOutFee: 4,
    extrasPrice: 31,
    depositAmount: 17,
  });
  expect(result.current.priceBreakdown.totalPrice).toBeCloseTo(34.015, 10);
  expect(
    result.current.formatCurrency(result.current.priceBreakdown.totalPrice)
  ).toBe('€34.02');
});

test('preview formatting keeps Settings currency, signed amounts, and the USD fallback', () => {
  mockSettings = { ...settings, currency: 'JPY' };
  const { result, rerender } = renderHook(() => useBookingForm());
  expect(result.current.formatCurrency(-1234.5)).toBe('-¥1,235');
  mockSettings = undefined;
  rerender();
  expect(result.current.formatCurrency(1.005)).toBe('$1.01');
});

test('negative guest drafts preserve the preview and validation until the value is corrected', () => {
  mockSettings = settings;
  const { result } = renderHook(() => useBookingForm());
  act(() => {
    result.current.handleInputChange('cabin', mockCabins[0]._id);
    result.current.handleInputChange('customer', 'user_guest');
    result.current.handleInputChange('checkInDate', '2040-01-01');
    result.current.handleInputChange('checkOutDate', '2040-01-02');
    result.current.handleInputChange('hasBreakfast', true);
    result.current.handleInputChange('numGuests', -100);
  });
  expect(result.current.formData.numGuests).toBe(-100);
  expect(result.current.priceBreakdown.breakfastPrice).toBe(-250);
  expect(result.current.priceBreakdown.totalPrice).toBeCloseTo(-248.995, 10);
  expect(result.current.priceBreakdown.depositAmount).toBe(-124);
  expect(result.current.validateForm()).toContain(
    'Number of guests must be at least 1'
  );
  const parsed = createBookingSchema.safeParse(
    result.current.buildBookingData()
  );
  expect(parsed.success).toBe(false);
  if (!parsed.success) {
    expect(
      parsed.error.issues.some(issue => issue.path[0] === 'numGuests')
    ).toBe(true);
  }
  act(() => {
    result.current.handleInputChange('numGuests', 2);
  });
  expect(result.current.priceBreakdown.totalPrice).toBeCloseTo(6.005, 10);
  expect(result.current.priceBreakdown.depositAmount).toBe(3);
  expect(result.current.validateForm()).toEqual([]);
});

test('preview formatter rejects invalid transport amounts', () => {
  const { result } = renderHook(() => useBookingForm());
  expect(() => result.current.formatCurrency(Infinity)).toThrow();
});

test('draft changes and refreshed settings render with their current price, without a stale preview', () => {
  mockSettings = settings;
  const previews: Array<{
    guests: number;
    breakfastRate?: number;
    price: number;
  }> = [];
  const { result, rerender } = renderHook(() => {
    const form = useBookingForm();
    previews.push({
      guests: form.formData.numGuests,
      breakfastRate: form.settings?.breakfastPrice,
      price: form.priceBreakdown.breakfastPrice,
    });
    return form;
  });

  act(() => {
    result.current.handleInputChange('cabin', mockCabins[0]._id);
    result.current.handleInputChange('checkInDate', '2040-01-01');
    result.current.handleInputChange('checkOutDate', '2040-01-03');
    result.current.handleInputChange('hasBreakfast', true);
    result.current.handleInputChange('numGuests', 2);
  });
  expect(result.current.priceBreakdown.breakfastPrice).toBe(10);

  const beforeRefresh = previews.length;
  mockSettings = { ...settings, breakfastPrice: 3 };
  rerender();
  expect(previews.slice(beforeRefresh)).toEqual([
    { guests: 2, breakfastRate: 3, price: 12 },
  ]);

  const beforeDraft = previews.length;
  act(() => result.current.handleInputChange('numGuests', 3));
  expect(previews.slice(beforeDraft)).toEqual([
    { guests: 3, breakfastRate: 3, price: 18 },
  ]);
});
