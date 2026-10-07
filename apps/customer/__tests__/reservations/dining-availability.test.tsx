import { render, screen } from '@testing-library/react';
import DiningReservationForm from '@/components/DiningReservationForm';
import type { Dining } from '@/types';
jest.mock('@/hooks/useDiningReservation', () => ({
  useCreateDiningReservation: () => ({
    isPending: false,
    mutateAsync: jest.fn(),
  }),
  useDiningAvailability: () => ({
    data: {
      diningId: '507f1f77bcf86cd799439011',
      date: '2040-01-01',
      time: null,
      seatsRemaining: null,
      maxPeople: null,
      isAvailable: true,
      servingTime: { start: '17:00', end: '22:00' },
    },
    isLoading: false,
  }),
}));
jest.mock('@clerk/nextjs', () => ({
  useUser: () => ({ user: { id: 'customer' } }),
}));
const dining: Dining = {
  _id: '507f1f77bcf86cd799439011',
  name: 'Dinner',
  description: 'Dinner',
  type: 'menu',
  mealType: 'dinner',
  category: 'regular',
  price: 25,
  image: '/dinner.jpg',
  maxPeople: 0,
  servingTime: { start: '17:00', end: '22:00' },
};
test('an unlimited availability response does not disable reservation submission', () => {
  render(<DiningReservationForm dining={dining} />);
  expect(screen.getByRole('button', { name: 'Reserve Now' })).toBeEnabled();
});
