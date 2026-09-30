import { render, screen, waitFor } from '@/__tests__/shared/test-utils';
import CabinsListClient from '@/components/CabinsListClient';
import { createCabinFixture } from '@/__tests__/shared/cabin-fixture';

afterEach(() => window.history.replaceState({}, '', '/'));

test('retains URL price/capacity filters on serialized initial cabins', async () => {
  window.history.replaceState(
    {},
    '',
    '/cabins?capacity=4&minPrice=50&maxPrice=200'
  );
  render(
    <CabinsListClient
      initialCabins={[
        createCabinFixture({ name: 'Affordable Cabin', price: 100 }),
        createCabinFixture({
          _id: '507f1f77bcf86cd7994390ac',
          name: 'Luxury Cabin',
          price: 300,
        }),
        createCabinFixture({
          _id: '507f1f77bcf86cd7994390ad',
          name: 'Small Cabin',
          capacity: 2,
        }),
      ]}
    />
  );
  await waitFor(() =>
    expect(screen.queryByText('Luxury Cabin')).not.toBeInTheDocument()
  );
  expect(screen.queryByText('Small Cabin')).not.toBeInTheDocument();
  expect(screen.getByText('Affordable Cabin')).toBeInTheDocument();
});

test('honors a zero maximum price from the URL', async () => {
  window.history.replaceState({}, '', '/cabins?maxPrice=0');
  render(<CabinsListClient initialCabins={[createCabinFixture()]} />);
  await waitFor(() =>
    expect(screen.getByText('No cabins found')).toBeInTheDocument()
  );
  expect(screen.queryByText('Pine Cabin')).not.toBeInTheDocument();
});
