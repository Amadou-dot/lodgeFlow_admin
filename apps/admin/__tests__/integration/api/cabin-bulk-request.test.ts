import { NextRequest } from 'next/server';
import { Types } from 'mongoose';
import { AuditLog, Booking, Cabin } from '@lodgeflow/database';
import { POST } from '@/app/api/cabins/bulk/route';
import { createErrorResponse, requireApiAuth } from '@/lib/api-utils';
import connectDB from '@/lib/mongodb';
import { logger } from '@/lib/logger';

jest.mock('@/lib/mongodb', () => jest.fn().mockResolvedValue(undefined));
jest.mock('@/lib/logger', () => ({
  logger: { error: jest.fn(), info: jest.fn() },
}));

const originalOrganization = process.env.LODGEFLOW_STAFF_ORG_ID;
const id = 'abcdefabcdefabcdefabcdef';
beforeEach(() => {
  jest.clearAllMocks();
  process.env.LODGEFLOW_STAFF_ORG_ID = 'org_bulk_request';
  jest.mocked(requireApiAuth).mockResolvedValue({
    authenticated: true,
    userId: 'user_manager',
    role: 'manager',
  });
});
afterEach(() => {
  if (originalOrganization === undefined)
    delete process.env.LODGEFLOW_STAFF_ORG_ID;
  else process.env.LODGEFLOW_STAFF_ORG_ID = originalOrganization;
  jest.restoreAllMocks();
});

function request(body: unknown) {
  return new NextRequest('https://admin.test/api/cabins/bulk', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}
function createCabin({ name = 'River', price = 200, discount = 0 } = {}) {
  return Cabin.create({
    name,
    price,
    discount,
    capacity: 4,
    description: 'Private cabin description',
    image: 'https://example.invalid/cabin.jpg',
  });
}
async function snapshot() {
  return JSON.stringify({
    cabins: await Cabin.find().sort({ _id: 1 }).lean(),
    bookings: await Booking.find().sort({ _id: 1 }).lean(),
    audits: await AuditLog.find().sort({ _id: 1 }).lean(),
  });
}

describe('bulk request characterization', () => {
  test.each([401, 403])(
    'denies %i before reading a discount operation or connecting',
    async status => {
      const error = createErrorResponse('Denied', status);
      jest
        .mocked(requireApiAuth)
        .mockResolvedValue({ authenticated: false, error });
      const input = request({
        action: 'update-discount',
        ids: [id],
        discount: 5,
      });
      const parse = jest.spyOn(input, 'json');
      expect(await POST(input)).toBe(error);
      expect(requireApiAuth).toHaveBeenCalledWith({
        permission: 'cabins:write',
      });
      expect(parse).not.toHaveBeenCalled();
      expect(connectDB).not.toHaveBeenCalled();
    }
  );

  test.each<[string, unknown, string]>([
    ['missing fields', {}, 'action and ids (non-empty array) are required'],
    [
      'missing action',
      { ids: [id] },
      'action and ids (non-empty array) are required',
    ],
    [
      'empty action before invalid IDs',
      { action: '', ids: ['bad'] },
      'action and ids (non-empty array) are required',
    ],
    [
      'empty IDs before unknown action',
      { action: 'other', ids: [] },
      'action and ids (non-empty array) are required',
    ],
    [
      'non-array IDs',
      { action: 'delete', ids: id },
      'action and ids (non-empty array) are required',
    ],
    [
      'invalid IDs before unknown action',
      { action: 'other', ids: ['bad'] },
      'Each id must be a valid ObjectId string',
    ],
    [
      'object ID input',
      { action: 'delete', ids: [{ $ne: null }] },
      'Each id must be a valid ObjectId string',
    ],
    [
      'invalid IDs before count',
      { action: 'delete', ids: Array(51).fill('bad') },
      'Each id must be a valid ObjectId string',
    ],
    [
      'count before action',
      { action: 'other', ids: Array(51).fill(id) },
      'Cannot process more than 50 items at once',
    ],
    ['unknown action', { action: 'other', ids: [id] }, 'Unknown action: other'],
    [
      'missing discount',
      { action: 'update-discount', ids: [id] },
      'discount (number) is required',
    ],
    [
      'null discount',
      { action: 'update-discount', ids: [id], discount: null },
      'discount (number) is required',
    ],
    [
      'string discount',
      { action: 'update-discount', ids: [id], discount: '5' },
      'discount (number) is required',
    ],
    [
      'negative discount',
      { action: 'update-discount', ids: [id], discount: -1 },
      'Discount must be a non-negative number',
    ],
  ])(
    'preserves %s rejection and no-write behavior',
    async (_label, body, message) => {
      await createCabin();
      const before = await snapshot();
      const response = await POST(request(body));
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ success: false, error: message });
      expect(await snapshot()).toBe(before);
    }
  );

  test('rejects the whole discount batch if any price is not greater', async () => {
    const cheap = await createCabin({ name: 'Cheap', price: 50 });
    const same = await createCabin({ name: 'Equal', price: 100 });
    const expensive = await createCabin({ name: 'Expensive', price: 300 });
    const before = await snapshot();
    const response = await POST(
      request({
        action: 'update-discount',
        ids: [String(expensive._id), String(cheap._id), String(same._id)],
        discount: 100,
      })
    );
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      success: false,
      error:
        'Discount ($100) exceeds or equals price for: Cheap ($50), Equal ($100)',
    });
    expect(await snapshot()).toBe(before);
  });

  test.each([0, 25.5])(
    'updates selected cabins to %p and preserves counts, data and audit attribution',
    async discount => {
      const selected = await createCabin({ discount: 10 });
      const untouched = await createCabin({ name: 'Unselected', discount: 15 });
      const untouchedBefore = JSON.stringify(
        await Cabin.findById(untouched._id).lean()
      );
      const response = await POST(
        request({
          action: 'update-discount',
          ids: [
            String(selected._id).toUpperCase(),
            String(selected._id),
            String(new Types.ObjectId()),
          ],
          discount,
        })
      );
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({
        success: true,
        data: { modifiedCount: 1 },
      });
      expect(await Cabin.findById(selected._id).lean()).toMatchObject({
        name: 'River',
        price: 200,
        discount,
      });
      expect(JSON.stringify(await Cabin.findById(untouched._id).lean())).toBe(
        untouchedBefore
      );
      expect(await AuditLog.countDocuments()).toBe(1);
      expect(await AuditLog.findOne().lean()).toMatchObject({
        actor: 'user_manager',
        actorRole: 'manager',
        organizationId: 'org_bulk_request',
        action: 'cabin.update',
        resourceId: String(selected._id),
        before: { discount: 10 },
        after: { discount },
      });
    }
  );

  test('accepts exactly fifty IDs without auditing nonexistent cabins', async () => {
    const response = await POST(
      request({
        action: 'update-discount',
        ids: Array(50).fill(id),
        discount: 5,
      })
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      success: true,
      data: { modifiedCount: 0 },
    });
    expect(await AuditLog.countDocuments()).toBe(0);
  });
});

describe('bulk request regressions', () => {
  test.each<[string, string]>([
    ['malformed JSON', '{'],
    ['null body', 'null'],
    ['non-string action', JSON.stringify({ action: { $ne: null }, ids: [id] })],
    [
      'non-finite JSON number',
      `{"action":"update-discount","ids":["${id}"],"discount":1e400}`,
    ],
    [
      'contradictory operation',
      JSON.stringify({ action: 'delete', ids: [id], discount: 5 }),
    ],
    [
      'operator key',
      JSON.stringify({ action: 'delete', ids: [id], $set: { price: 1 } }),
    ],
    [
      'dotted key',
      JSON.stringify({ action: 'delete', ids: [id], 'cabin.price': 1 }),
    ],
    ['immutable key', JSON.stringify({ action: 'delete', ids: [id], _id: id })],
    [
      'server-owned price',
      JSON.stringify({
        action: 'update-discount',
        ids: [id],
        discount: 5,
        price: 100,
      }),
    ],
    ['prototype key', `{"action":"delete","ids":["${id}"],"__proto__":{}}`],
  ])('safely rejects %s without writes', async (_label, body) => {
    await createCabin();
    const before = await snapshot();
    const response = await POST(
      new NextRequest('https://admin.test/api/cabins/bulk', {
        method: 'POST',
        body,
      })
    );
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      success: false,
      error: 'Invalid bulk operation data',
    });
    expect(await snapshot()).toBe(before);
  });

  test('logs and contains connection failure', async () => {
    const fault = new Error('Private connection detail');
    jest.mocked(connectDB).mockRejectedValueOnce(fault);
    const response = await POST(request({ action: 'delete', ids: [id] }));
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      success: false,
      error: 'Bulk operation failed',
    });
    expect(logger.error).toHaveBeenCalledWith(
      'Bulk cabin operation failed',
      fault
    );
  });

  test.each([
    'booking read',
    'cabin read',
    'delete',
    'discount write',
    'non-Error rejection',
  ])('contains asynchronous %s failure without writes', async stage => {
    const cabin = await createCabin();
    const before = await snapshot();
    const fault =
      stage === 'non-Error rejection'
        ? 'Private string detail'
        : new Error('Private database detail');
    const action = stage === 'discount write' ? 'update-discount' : 'delete';
    const fail = () => {
      throw fault;
    };
    if (stage === 'booking read' || stage === 'non-Error rejection')
      jest.spyOn(Booking, 'find').mockImplementationOnce(fail);
    if (stage === 'cabin read')
      jest.spyOn(Cabin, 'find').mockImplementationOnce(fail);
    if (stage === 'delete')
      jest.spyOn(Cabin, 'deleteMany').mockImplementationOnce(fail);
    if (stage === 'discount write')
      jest.spyOn(Cabin, 'updateMany').mockImplementationOnce(fail);
    const response = await POST(
      request({
        action,
        ids: [String(cabin._id)],
        ...(action === 'update-discount' ? { discount: 5 } : {}),
      })
    );
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      success: false,
      error: 'Bulk operation failed',
    });
    expect(logger.error).toHaveBeenCalledWith(
      'Bulk cabin operation failed',
      fault instanceof Error ? fault : undefined
    );
    expect(await snapshot()).toBe(before);
  });
});
