/** @jest-environment node */
import mongoose, { type FilterQuery } from 'mongoose';
import CabinModel, { type ICabin } from '@lodgeflow/database/models/Cabin';
import { NextRequest } from 'next/server';

const TypedCabin = mongoose.model<ICabin>('Cabin', CabinModel.schema);
type CabinDocument = InstanceType<typeof TypedCabin>;
const mockConnect = jest.fn<Promise<void>, []>();
const mockFindById = jest.fn<Promise<CabinDocument | null>, [string]>();
const mockSort = jest.fn<Promise<CabinDocument[]>, [object]>();
const mockFind = jest.fn<{ sort: typeof mockSort }, [FilterQuery<ICabin>]>(
  () => ({ sort: mockSort })
);
const mockBookingFind = jest.fn<
  Promise<{ _id: mongoose.Types.ObjectId }[]>,
  [object]
>();
jest.mock('@lodgeflow/database', () => ({
  connectDB: () => mockConnect(),
  Cabin: {
    findById: (id: string) => mockFindById(id),
    find: (query: FilterQuery<ICabin>) => mockFind(query),
  },
  Booking: { find: (query: object) => mockBookingFind(query) },
}));
// The React request cache is framework-owned. These tests exercise its loader;
// HTTP coverage separately executes the real server-rendered page.
jest.mock('react', () => ({
  ...jest.requireActual<typeof import('react')>('react'),
  cache: <Args extends unknown[], Result>(fn: (...args: Args) => Result) => fn,
}));

import { GET as listCabins } from '@/app/api/cabins/route';
import { GET as readCabin } from '@/app/api/cabins/[id]/route';
import { POST as checkAvailability } from '@/app/api/cabins/availability/route';
import { getCabinById, getAllActiveCabinsForListing } from '@/lib/data/cabins';

const cabinId = '507f1f77bcf86cd7994390ab';
function cabin() {
  return new TypedCabin({
    _id: cabinId,
    name: 'Pine Cabin',
    description: 'A forest retreat',
    image: 'https://example.invalid/pine.jpg',
    images: ['https://example.invalid/inside.jpg'],
    capacity: 4,
    price: 200.5,
    discount: 25.25,
    amenities: ['WiFi', 'Kitchen'],
    extraGuestFee: 10.5,
    bedrooms: 2,
    bathrooms: 1,
    size: 600,
    minNights: 2,
    createdAt: new Date('2030-01-01T10:00:00-06:00'),
    updatedAt: new Date('2030-02-01T10:00:00-06:00'),
    __v: 4,
  });
}
function json(value: unknown): unknown {
  return JSON.parse(JSON.stringify(value));
}
function detail(id = cabinId) {
  return readCabin(new NextRequest(`http://localhost/api/cabins/${id}`), {
    params: Promise.resolve({ id }),
  });
}
function listing(query = '') {
  return listCabins(new NextRequest(`http://localhost/api/cabins${query}`));
}
function availability(body: object) {
  return checkAvailability(
    new NextRequest('http://localhost/api/cabins/availability', {
      method: 'POST',
      body: JSON.stringify(body),
    })
  );
}
beforeEach(() => {
  jest.resetAllMocks();
  jest.spyOn(console, 'error').mockImplementation(() => {});
  mockConnect.mockResolvedValue();
  mockFind.mockReturnValue({ sort: mockSort });
  mockFindById.mockResolvedValue(cabin());
  mockSort.mockResolvedValue([cabin()]);
  mockBookingFind.mockResolvedValue([]);
});
afterEach(() => jest.restoreAllMocks());

describe('cabin catalog characterization', () => {
  test('returns full hydrated detail JSON with IDs, dates, optional fields and virtuals', async () => {
    const row = cabin();
    mockFindById.mockResolvedValue(row);
    const before = JSON.stringify(row);
    const response = await detail(cabinId.toUpperCase());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true, data: json(row) });
    expect(mockFindById).toHaveBeenCalledWith(cabinId.toUpperCase());
    expect(JSON.stringify(row)).toBe(before);
  });

  test('preserves omitted optional fields and explicit legacy nulls', async () => {
    const row = cabin();
    row.$set({
      bedrooms: undefined,
      bathrooms: null,
      size: undefined,
      minNights: null,
      createdAt: null,
      updatedAt: undefined,
      __v: undefined,
    });
    mockFindById.mockResolvedValue(row);
    const response = await detail();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true, data: json(row) });
    expect(await getCabinById(cabinId)).toStrictEqual(json(row));
  });

  test.each(['inactive', 'maintenance'])(
    'hides %s cabins from detail API',
    async status => {
      const row = cabin();
      row.$set('status', status);
      mockFindById.mockResolvedValue(row);
      const response = await detail();
      expect(response.status).toBe(404);
      expect(await response.json()).toEqual({
        success: false,
        error: 'Cabin not found',
      });
    }
  );

  test('returns a safe missing-cabin response', async () => {
    mockFindById.mockResolvedValue(null);
    const response = await detail();
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      success: false,
      error: 'Cabin not found',
    });
  });

  test('retains active-only listing, positive filters, regex search and price sort', async () => {
    const rows = [cabin()];
    mockSort.mockResolvedValue(rows);
    const response = await listing(
      '?capacity=4&minPrice=50&maxPrice=250&search=pine&status=inactive&available=true'
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true, data: json(rows) });
    expect(mockFind).toHaveBeenCalledWith({
      status: 'active',
      capacity: { $gte: 4 },
      price: { $gte: 50, $lte: 250 },
      $or: [
        { name: { $regex: 'pine', $options: 'i' } },
        { description: { $regex: 'pine', $options: 'i' } },
        { amenities: { $regex: 'pine', $options: 'i' } },
      ],
    });
    expect(mockSort).toHaveBeenCalledWith({ price: 1 });
  });

  test('keeps invalid query responses and avoids querying cabins', async () => {
    const response = await listing('?capacity=0&minPrice=-1');
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ success: false });
    expect(mockFind).not.toHaveBeenCalled();
  });

  test('returns an empty list without matches', async () => {
    mockSort.mockResolvedValue([]);
    expect(await (await listing()).json()).toEqual({ success: true, data: [] });
  });

  test('retains safe errors for detail and listing query failures', async () => {
    mockFindById.mockRejectedValueOnce(new Error('private database details'));
    mockSort.mockRejectedValueOnce(new Error('private database details'));
    const detailResponse = await detail();
    const listResponse = await listing();
    expect(detailResponse.status).toBe(500);
    expect(await detailResponse.json()).toEqual({
      success: false,
      error: 'Internal server error',
    });
    expect(listResponse.status).toBe(500);
    expect(await listResponse.json()).toEqual({
      success: false,
      error: 'Failed to fetch cabins',
    });
  });

  test('serializes the server page detail and listing to the same complete JSON', async () => {
    const row = cabin();
    mockFindById.mockResolvedValue(row);
    mockSort.mockResolvedValue([row]);
    expect(await getCabinById(cabinId)).toEqual(json(row));
    expect(await getAllActiveCabinsForListing()).toEqual(json([row]));
    expect(mockFind).toHaveBeenCalledWith({ status: 'active' });
    expect(mockSort).toHaveBeenCalledWith({ price: 1 });
  });

  test('server loaders preserve missing/error fallbacks', async () => {
    mockFindById.mockResolvedValueOnce(null);
    expect(await getCabinById(cabinId)).toBeNull();
    mockFindById.mockRejectedValueOnce(new Error('private database details'));
    expect(await getCabinById(cabinId)).toBeNull();
    mockSort.mockRejectedValueOnce(new Error('private database details'));
    expect(await getAllActiveCabinsForListing()).toEqual([]);
  });

  test('server detail avoids database access for an empty ID', async () => {
    expect(await getCabinById('')).toBeNull();
    expect(mockConnect).not.toHaveBeenCalled();
    expect(mockFindById).not.toHaveBeenCalled();
  });

  test.each([false, true])(
    'availability includes the same cabin JSON and conflict IDs (occupied: %s)',
    async occupied => {
      const row = cabin();
      const conflictId = new mongoose.Types.ObjectId(
        '507f1f77bcf86cd799439012'
      );
      mockSort.mockResolvedValue([row]);
      mockBookingFind.mockResolvedValue(occupied ? [{ _id: conflictId }] : []);
      const response = await availability({
        checkInDate: '2030-06-01',
        checkOutDate: '2030-06-04',
        guests: 4,
      });
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({
        success: true,
        data: [
          {
            ...row.toJSON(),
            _id: cabinId,
            createdAt: '2030-01-01T16:00:00.000Z',
            updatedAt: '2030-02-01T16:00:00.000Z',
            isAvailable: !occupied,
            conflictingBookings: occupied ? [conflictId.toHexString()] : [],
          },
        ],
      });
      expect(mockFind).toHaveBeenCalledWith(
        expect.objectContaining({ capacity: { $gte: 4 } })
      );
      expect(mockBookingFind).toHaveBeenCalledWith({
        cabin: row._id,
        status: { $nin: ['cancelled'] },
        $or: [
          {
            checkInDate: { $lt: new Date('2030-06-04') },
            checkOutDate: { $gt: new Date('2030-06-01') },
          },
        ],
      });
    }
  );
});

describe('cabin catalog regressions', () => {
  test('availability selects only the active cabin catalog', async () => {
    const response = await availability({
      checkInDate: '2030-06-01',
      checkOutDate: '2030-06-04',
      guests: 4,
    });
    expect(response.status).toBe(200);
    expect(mockFind).toHaveBeenCalledWith({
      status: 'active',
      capacity: { $gte: 4 },
    });
  });

  test('applies an explicit zero price limit', async () => {
    expect((await listing('?minPrice=0&maxPrice=0')).status).toBe(200);
    expect(mockFind).toHaveBeenCalledWith({
      status: 'active',
      price: { $gte: 0, $lte: 0 },
    });
  });

  test.each(['inactive', 'maintenance'])(
    'hides %s cabins from the server-rendered page loader',
    async status => {
      const row = cabin();
      row.$set('status', status);
      mockFindById.mockResolvedValue(row);
      expect(await getCabinById(cabinId)).toBeNull();
    }
  );

  test.each(['invalid', '507f1f77bcf86cd7994390az'])(
    'rejects malformed detail ID %s before database access',
    async id => {
      mockFindById.mockRejectedValueOnce(new Error('database cast error'));
      const response = await detail(id);
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({
        success: false,
        error: 'Invalid cabin ID',
      });
      expect(mockConnect).not.toHaveBeenCalled();
      expect(mockFindById).not.toHaveBeenCalled();
      expect(await getCabinById(id)).toBeNull();
      expect(mockConnect).not.toHaveBeenCalled();
    }
  );
});
