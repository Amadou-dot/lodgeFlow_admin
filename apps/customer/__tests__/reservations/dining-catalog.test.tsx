import { render, screen } from '@/__tests__/shared/test-utils';
import DiningPage from '@/app/dining/page';
import type { Dining } from '@/types';
const mockDining = jest.fn();
jest.mock('@/hooks/useDining', () => ({
  useDining: (...args: unknown[]) => mockDining(...args),
}));
const dish: Dining = {
  _id: '507f1f77bcf86cd799439011',
  name: 'Zucchini Soup',
  description: 'Local vegetables',
  type: 'menu',
  mealType: 'lunch',
  price: 12,
  servingTime: { start: '12:00', end: '15:00' },
  maxPeople: 20,
  category: 'regular',
  image: 'https://example.test/soup.jpg',
};
test('keeps default name ordering, meal grouping and the first menu reservation link', () => {
  mockDining.mockReturnValue({
    data: [
      dish,
      { ...dish, _id: '507f1f77bcf86cd799439012', name: 'Apple Soup' },
    ],
  });
  render(<DiningPage />);
  const names = screen
    .getAllByRole('heading', { level: 5 })
    .map(item => item.textContent);
  expect(names).toEqual(['Apple Soup', 'Zucchini Soup']);
  expect(screen.getByRole('link', { name: 'Reserve Lunch' })).toHaveAttribute(
    'href',
    '/dining/507f1f77bcf86cd799439012/reserve'
  );
  expect(mockDining).toHaveBeenCalledWith({ search: undefined });
});
