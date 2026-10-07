import { fireEvent, render, screen } from '@/__tests__/shared/test-utils';
import type { ComponentProps } from 'react';
import type StandardFilters from '@/components/StandardFilters';
import CabinsListClient from '@/components/CabinsListClient';
import { createCabinFixture } from '@/__tests__/shared/cabin-fixture';
jest.mock('@/components/StandardFilters', () => ({
  __esModule: true,
  default: ({
    onSortChange,
    onSortOrderChange,
  }: ComponentProps<typeof StandardFilters>) => (
    <div>
      <button onClick={() => onSortChange('price')}>Price</button>
      <button onClick={() => onSortChange('capacity')}>Capacity</button>
      <button onClick={() => onSortOrderChange('desc')}>Descending</button>
    </div>
  ),
}));
jest.mock('@/components/CabinCard', () => ({
  __esModule: true,
  default: ({ cabin }: { cabin: ReturnType<typeof createCabinFixture> }) => (
    <div data-testid='cabin'>{cabin.name}</div>
  ),
}));
test('sorts serialized cabins by name, numeric price and numeric capacity', () => {
  render(
    <CabinsListClient
      initialCabins={[
        createCabinFixture({ name: 'zebra', price: 9, capacity: 12 }),
        createCabinFixture({
          _id: '507f1f77bcf86cd799439012',
          name: 'Alpha',
          price: 100,
          capacity: 2,
        }),
      ]}
    />
  );
  const names = () =>
    screen.getAllByTestId('cabin').map(node => node.textContent);
  expect(names()).toEqual(['Alpha', 'zebra']);
  fireEvent.click(screen.getByText('Price'));
  expect(names()).toEqual(['zebra', 'Alpha']);
  fireEvent.click(screen.getByText('Capacity'));
  expect(names()).toEqual(['Alpha', 'zebra']);
  fireEvent.click(screen.getByText('Descending'));
  expect(names()).toEqual(['zebra', 'Alpha']);
});
