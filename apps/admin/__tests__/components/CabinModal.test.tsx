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
const mutationProps = {
  onCreateSubmit: mockCreate,
  onUpdateSubmit: mockUpdate,
  isSaving: false,
};
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
  render(
    <CabinModal
      {...mutationProps}
      isOpen
      onClose={close}
      cabin={cabin}
      mode='edit'
    />
  );
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

test('preserves legacy null fields and blank amenity entries during unrelated edits', async () => {
  const legacy = {
    ...cabin,
    discount: null,
    discountedPrice: cabin.price,
    images: null,
    status: null,
    extraGuestFee: null,
    amenities: ['WiFi', null, ''],
  };
  render(
    <CabinModal
      {...mutationProps}
      isOpen
      onClose={jest.fn()}
      cabin={legacy}
      mode='edit'
    />
  );
  expect(await screen.findByPlaceholderText('Enter discount')).toHaveValue(0);
  fireEvent.change(screen.getByDisplayValue('Pine Cabin'), {
    target: { value: 'Renamed Cabin' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));
  await waitFor(() => expect(mockUpdate).toHaveBeenCalledTimes(1));
  expect(JSON.parse(JSON.stringify(mockUpdate.mock.calls[0][0]))).toEqual({
    _id: cabin._id,
    name: 'Renamed Cabin',
    image: cabin.image,
    price: cabin.price,
    capacity: cabin.capacity,
    description: cabin.description,
  });
});

test('submits Active when staff explicitly select it for a cabin with null status', async () => {
  render(
    <CabinModal
      {...mutationProps}
      isOpen
      onClose={jest.fn()}
      cabin={{ ...cabin, status: null }}
      mode='edit'
    />
  );

  fireEvent.click(await screen.findByRole('button', { name: /Status/ }));
  fireEvent.click(await screen.findByRole('option', { name: 'Active' }));
  fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));

  await waitFor(() => expect(mockUpdate).toHaveBeenCalledTimes(1));
  expect(mockUpdate.mock.calls[0][0]).toMatchObject({
    _id: cabin._id,
    status: 'active',
  });
});

test('view mode passes the same JSON cabin to the edit action', async () => {
  const edit = jest.fn();
  render(
    <CabinModal
      {...mutationProps}
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
  render(
    <CabinModal
      {...mutationProps}
      isOpen
      onClose={jest.fn()}
      cabin={null}
      mode='create'
    />
  );
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
  render(
    <CabinModal
      {...mutationProps}
      isOpen
      onClose={jest.fn()}
      cabin={cabin}
      mode='edit'
    />
  );
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

test('explicitly setting null fees to zero and emptying a null gallery updates only that cabin', async () => {
  const editor = (id: string) => (
    <CabinModal
      {...mutationProps}
      isOpen
      onClose={jest.fn()}
      cabin={{
        ...cabin,
        _id: id,
        id,
        discount: null,
        extraGuestFee: null,
        images: null,
      }}
      mode='edit'
    />
  );
  const view = render(editor(cabin._id));
  for (const label of ['Enter discount', 'Per guest above base']) {
    const field = await screen.findByPlaceholderText(label);
    fireEvent.change(field, { target: { value: '5' } });
    fireEvent.change(field, { target: { value: '0' } });
  }
  fireEvent.change(screen.getByPlaceholderText('Add image URL'), {
    target: { value: 'https://example.invalid/gallery.jpg' },
  });
  fireEvent.click(screen.getAllByRole('button', { name: 'Add' })[0]);
  fireEvent.click(await screen.findByRole('button', { name: '×' }));
  fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));
  await waitFor(() => expect(mockUpdate).toHaveBeenCalledTimes(1));
  expect(mockUpdate.mock.calls[0][0]).toMatchObject({
    discount: 0,
    extraGuestFee: 0,
    images: [],
  });
  view.rerender(editor('507f1f77bcf86cd799439012'));
  fireEvent.change(screen.getByDisplayValue(cabin.name), {
    target: { value: 'Another cabin' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));
  await waitFor(() => expect(mockUpdate).toHaveBeenCalledTimes(2));
  const next = mockUpdate.mock.calls[1][0];
  expect(next.name).toBe('Another cabin');
  expect(next.discount).toBeUndefined();
  expect(next.extraGuestFee).toBeUndefined();
  expect(next.images).toBeUndefined();
});
