import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { isImageUrl } from '@/utils/utilityFunctions';
import CabinModal from '@/components/CabinModal';
import type { Cabin, CreateCabinData, UpdateCabinData } from '@/types';

const mockCreate = jest.fn<Promise<void>, [CreateCabinData]>();
const mockUpdate = jest.fn<Promise<void>, [UpdateCabinData]>();
jest.mock('@/hooks/useCabins', () => ({
  useCreateCabin: () => ({ mutateAsync: mockCreate, isPending: false }),
  useUpdateCabin: () => ({ mutateAsync: mockUpdate, isPending: false }),
}));
jest.mock('@/components/AuthGuard', () => ({ usePermission: () => true }));
jest.mock('@/utils/utilityFunctions', () => ({
  isImageUrl: jest.fn().mockResolvedValue(true),
}));
jest.mock('next/image', () => ({
  __esModule: true,
  default: ({ src, alt }: { src: string; alt: string }) => (
    <img src={src} alt={alt} />
  ),
}));

const cabin: Cabin = {
  _id: '507f1f77bcf86cd799439011',
  id: '507f1f77bcf86cd799439011',
  name: 'Pine Cabin',
  image: 'https://example.invalid/pine.jpg',
  images: [],
  capacity: 4,
  price: 200,
  discount: 25,
  discountedPrice: 175,
  description: 'A quiet cabin in the forest',
  amenities: ['WiFi'],
  status: 'active',
  extraGuestFee: 0,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  bedrooms: null,
  bathrooms: null,
  size: null,
  minNights: null,
};
beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(isImageUrl).mockResolvedValue(true);
  mockCreate.mockResolvedValue(undefined);
  mockUpdate.mockResolvedValue(undefined);
});

test('edits JSON data with omitted legacy null options and only writable fields', async () => {
  const close = jest.fn();
  render(<CabinModal isOpen onClose={close} cabin={cabin} mode='edit' />);
  fireEvent.change(await screen.findByDisplayValue('Pine Cabin'), {
    target: { value: 'Renamed Cabin' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));
  await waitFor(() => expect(mockUpdate).toHaveBeenCalledTimes(1));
  const input = mockUpdate.mock.calls[0][0];
  expect(JSON.parse(JSON.stringify(input))).toEqual({
    _id: cabin._id,
    name: 'Renamed Cabin',
    image: cabin.image,
    images: [],
    capacity: 4,
    price: 200,
    discount: 25,
    description: cabin.description,
    amenities: ['WiFi'],
    status: 'active',
    extraGuestFee: 0,
  });
  await waitFor(() => expect(close).toHaveBeenCalledTimes(1));
});

test('view mode passes the same JSON cabin to the edit action', async () => {
  const edit = jest.fn();
  render(
    <CabinModal
      isOpen
      onClose={jest.fn()}
      cabin={cabin}
      mode='view'
      onEdit={edit}
    />
  );
  fireEvent.click(await screen.findByRole('button', { name: 'Edit Cabin' }));
  expect(edit).toHaveBeenCalledWith(cabin);
  expect(mockUpdate).not.toHaveBeenCalled();
});

test('create mode accepts explicit absent cabin data', async () => {
  render(<CabinModal isOpen onClose={jest.fn()} cabin={null} mode='create' />);
  expect(
    await screen.findByRole('button', { name: 'Create Cabin' })
  ).toBeDisabled();
  expect(mockCreate).not.toHaveBeenCalled();
});

test('ignores a late image validation from the previous URL', async () => {
  let finishOld: (valid: boolean) => void = () => {
    throw new Error('not started');
  };
  jest.mocked(isImageUrl).mockImplementation(url =>
    url === cabin.image
      ? new Promise<boolean>(resolve => {
          finishOld = resolve;
        })
      : Promise.resolve(false)
  );
  render(<CabinModal isOpen onClose={jest.fn()} cabin={cabin} mode='edit' />);
  fireEvent.change(await screen.findByDisplayValue(cabin.image), {
    target: { value: 'https://example.invalid/broken.jpg' },
  });
  await waitFor(() =>
    expect(isImageUrl).toHaveBeenCalledWith(
      'https://example.invalid/broken.jpg'
    )
  );
  await act(async () => {
    finishOld(true);
  });
  expect(
    screen.queryByRole('img', { name: /preview/i })
  ).not.toBeInTheDocument();
});
