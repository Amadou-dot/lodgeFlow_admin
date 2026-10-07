import { act, renderHook } from '@testing-library/react';
import { useBookingForm } from '@/hooks/useBookingForm';
import { createBookingSchema } from '@/lib/validations/booking';
jest.mock('@/hooks/useCabins', () => ({ useCabins: () => ({ data: [] }) }));
jest.mock('@/hooks/useSettings', () => ({
  useSettings: () => ({ data: undefined }),
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
