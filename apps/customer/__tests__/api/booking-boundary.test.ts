/** @jest-environment node */
import { NextRequest } from 'next/server';
const mockAuth = jest.fn();
const mockConnect = jest.fn();
const mockCreate = jest.fn();
const mockUpdate = jest.fn();
const mockFind = jest.fn(() => ({ populate: async () => null }));
jest.mock('@clerk/nextjs/server', () => ({ auth: () => mockAuth() }));
jest.mock('@lodgeflow/database', () => ({
  ...jest.requireActual<typeof import('@lodgeflow/database')>(
    '@lodgeflow/database'
  ),
  connectDB: () => mockConnect(),
  createCustomerBooking: () => mockCreate(),
  updateCustomerBooking: () => mockUpdate(),
  Booking: { findById: () => mockFind() },
}));
import { POST } from '@/app/api/bookings/route';
import { PATCH, GET, DELETE } from '@/app/api/bookings/[id]/route';
const id = '507f1f77bcf86cd799439011';
const params = { params: Promise.resolve({ id }) };
const req = (body: string) =>
  new NextRequest('https://customer.test', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body,
  });
const create = {
  cabinId: id,
  checkInDate: '2040-01-01',
  checkOutDate: '2040-01-03',
  numGuests: 2,
};
const mutations = [
  { name: 'create', invoke: POST, input: create },
  {
    name: 'update',
    invoke: (r: NextRequest) => PATCH(r, params),
    input: { numGuests: 2 },
  },
  {
    name: 'cancel',
    invoke: (r: NextRequest) => DELETE(r, params),
    input: { reason: 'Changed plans' },
  },
];
beforeEach(() => {
  jest.clearAllMocks();
  mockAuth.mockResolvedValue({ userId: 'customer' });
  mockConnect.mockResolvedValue(undefined);
  mockCreate.mockRejectedValue(new Error('private'));
  mockUpdate.mockRejectedValue(new Error('private'));
});
afterEach(() => jest.restoreAllMocks());
test.each(mutations)(
  '$name rejects malformed/non-object JSON before effects',
  async ({ invoke }) => {
    for (const body of ['{', 'null', '[]', 'true']) {
      expect((await invoke(req(body))).status).toBe(400);
      expect(mockConnect).not.toHaveBeenCalled();
      expect(mockCreate).not.toHaveBeenCalled();
      expect(mockUpdate).not.toHaveBeenCalled();
    }
  }
);
test.each(mutations)(
  '$name rejects forged fields before effects',
  async ({ invoke, input }) => {
    for (const key of [
      'totalPrice',
      'customer',
      'payments',
      'checkoutPending',
      '$set',
      'extras.petFee',
      '__proto__',
    ]) {
      const body =
        JSON.stringify(input).slice(0, -1) + ',' + JSON.stringify(key) + ':1}';
      expect((await invoke(req(body))).status).toBe(400);
      expect(mockConnect).not.toHaveBeenCalled();
      expect(mockCreate).not.toHaveBeenCalled();
      expect(mockUpdate).not.toHaveBeenCalled();
    }
  }
);
test.each(mutations)(
  '$name denies access before parsing',
  async ({ invoke }) => {
    mockAuth.mockResolvedValueOnce({ userId: null });
    const request = req('{');
    const read = jest.spyOn(request, 'text');
    expect((await invoke(request)).status).toBe(401);
    expect(read).not.toHaveBeenCalled();
    expect(mockConnect).not.toHaveBeenCalled();
  }
);
test.each([GET, PATCH, DELETE])(
  'invalid booking IDs fail before database access',
  async invoke => {
    expect(
      (await invoke(req('{}'), { params: Promise.resolve({ id: 'invalid' }) }))
        .status
    ).toBe(404);
    expect(mockConnect).not.toHaveBeenCalled();
  }
);
test('create rejects numeric dates before effects', async () => {
  expect(
    (await POST(req(JSON.stringify({ ...create, checkInDate: 0 })))).status
  ).toBe(400);
  expect(mockConnect).not.toHaveBeenCalled();
});
test('empty cancellation body remains optional', async () => {
  expect((await DELETE(req(''), params)).status).toBe(404);
  expect(mockFind).toHaveBeenCalled();
});
