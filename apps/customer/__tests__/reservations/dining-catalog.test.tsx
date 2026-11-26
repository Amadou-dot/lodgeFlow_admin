import { render, screen } from '@/__tests__/shared/test-utils';
import DiningPage from '@/app/dining/page';
import DiningDetailPage from '@/app/dining/[id]/page';
import type { Dining } from '@/types';
const mockDining = jest.fn();
const mockDiningItem = jest.fn();
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

jest.mock('@/hooks/useDiningItem', () => ({
  useDiningItem: (id: string) => mockDiningItem(id),
}));
test('detail renders only the usable images in a legacy gallery', async () => {
  mockDiningItem.mockReturnValue({
    data: {
      ...dish,
      image: '/images/soup.jpg',
      gallery: ['', null, '/images/vegetables.jpg'],
    },
  });
  render(<DiningDetailPage params={Promise.resolve({ id: dish._id })} />);
  expect(await screen.findByText('Zucchini Soup')).toBeInTheDocument();
  expect(screen.getAllByAltText(/Zucchini Soup gallery/)).toHaveLength(1);
});
