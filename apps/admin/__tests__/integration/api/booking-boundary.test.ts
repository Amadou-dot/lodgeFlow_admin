import mongoose from 'mongoose';
import { NextRequest } from 'next/server';
import { POST, PUT } from '@/app/api/bookings/route';
import { PATCH } from '@/app/api/bookings/[id]/route';
import connectDB from '@/lib/mongodb';
import { createErrorResponse, requireApiAuth } from '@/lib/api-utils';
import { logger } from '@/lib/logger';
jest.mock('@/lib/mongodb', () => jest.fn().mockResolvedValue(undefined));
const id = '507f1f77bcf86cd799439011';
const create = {
  cabin: id,
  customer: 'user_guest',
  checkInDate: '2040-01-01',
  checkOutDate: '2040-01-03',
  numGuests: 2,
};
const request = (body: string) =>
  new NextRequest('https://admin.test/api/bookings', { method: 'POST', body });
const mutations = [
  { name: 'create', invoke: POST, input: create },
  { name: 'update', invoke: PUT, input: { _id: id } },
  {
    name: 'patch',
    invoke: (r: Request) => PATCH(r, { params: Promise.resolve({ id }) }),
    input: {},
  },
];
beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(connectDB).mockResolvedValue(mongoose);
  jest.mocked(requireApiAuth).mockResolvedValue({
    authenticated: true,
    userId: 'staff',
    role: 'manager',
  });
});
afterEach(() => jest.restoreAllMocks());
test.each(mutations)(
  '$name denies before body or database access',
  async ({ invoke }) => {
    jest.mocked(requireApiAuth).mockResolvedValueOnce({
      authenticated: false,
      error: createErrorResponse('Permission denied', 403),
    });
    const req = request('{');
    const read = jest.spyOn(req, 'text');
    expect((await invoke(req)).status).toBe(403);
    expect(read).not.toHaveBeenCalled();
    expect(connectDB).not.toHaveBeenCalled();
  }
);
test.each(mutations)(
  '$name rejects malformed or non-object JSON before connecting',
  async ({ invoke }) => {
    for (const body of ['{', 'null', '[]', 'true']) {
      expect((await invoke(request(body))).status).toBe(400);
      expect(connectDB).not.toHaveBeenCalled();
    }
  }
);
test.each(mutations)(
  '$name rejects protected fields before connecting',
  async ({ invoke, input }) => {
    for (const key of [
      'totalPrice',
      'remainingAmount',
      'isPaid',
      'depositPaid',
      'depositAmount',
      'payments',
      'createdAt',
      '$set',
      'extras.petFee',
      '__proto__',
    ]) {
      const body =
        JSON.stringify(input).slice(0, -1) + ',' + JSON.stringify(key) + ':1}';
      expect((await invoke(request(body))).status).toBe(400);
      expect(connectDB).not.toHaveBeenCalled();
    }
  }
);
test.each(mutations)(
  '$name logs unexpected failures without exposing arbitrary overlap messages',
  async ({ invoke, input }) => {
    const failure = new Error('private database overlap detail');
    jest.mocked(connectDB).mockRejectedValueOnce(failure);
    const log = jest.spyOn(logger, 'error');
    const response = await invoke(request(JSON.stringify(input)));
    expect(response.status).toBe(500);
    expect(JSON.stringify(await response.json())).not.toContain('private');
    expect(log).toHaveBeenCalledWith(
      expect.any(String),
      failure,
      ...(invoke === POST || invoke === PUT ? [] : [expect.any(Object)])
    );
  }
);
test.each(mutations.slice(1))(
  '$name preserves refund permission precedence for falsy fields',
  async ({ invoke, input }) => {
    jest
      .mocked(requireApiAuth)
      .mockResolvedValueOnce({
        authenticated: true,
        userId: 'staff',
        role: 'front_desk',
      })
      .mockResolvedValueOnce({
        authenticated: false,
        error: createErrorResponse('Permission denied', 403),
      });
    expect(
      (
        await invoke(
          request(JSON.stringify({ ...input, refundAmount: 0, invalid: true }))
        )
      ).status
    ).toBe(403);
    expect(connectDB).not.toHaveBeenCalled();
  }
);
test('create rejects numeric and null dates at the JSON boundary', async () => {
  for (const checkInDate of [null, 0, true]) {
    expect(
      (await POST(request(JSON.stringify({ ...create, checkInDate })))).status
    ).toBe(400);
    expect(connectDB).not.toHaveBeenCalled();
  }
});
