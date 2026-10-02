import { NextRequest } from 'next/server';
import { Types } from 'mongoose';
import { AuditLog, Booking, Cabin } from '@lodgeflow/database';
import type { IBooking } from '@lodgeflow/database/models/Booking';
import { POST } from '@/app/api/cabins/bulk/route';
import { createErrorResponse, requireApiAuth } from '@/lib/api-utils';
import connectDB from '@/lib/mongodb';

jest.mock('@/lib/mongodb', () => jest.fn().mockResolvedValue(undefined));

const originalOrganization = process.env.LODGEFLOW_STAFF_ORG_ID;
beforeEach(() => {
  jest.clearAllMocks();
  process.env.LODGEFLOW_STAFF_ORG_ID = 'org_bulk_delete';
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

function request(ids: string[]) {
  return new NextRequest('https://admin.test/api/cabins/bulk', {
    method: 'POST',
    body: JSON.stringify({ action: 'delete', ids }),
  });
}
function createCabin(name = 'River cabin') {
  return Cabin.create({
    name,
    description: 'Private cabin description',
    capacity: 4,
    price: 200,
    image: 'https://example.invalid/cabin.jpg',
  });
}
function createBooking({
  cabinId,
  status = 'confirmed',
}: {
  cabinId: Types.ObjectId;
  status?: IBooking['status'];
}) {
  return Booking.create({
    cabin: cabinId,
    customer: 'user_guest',
    checkInDate: new Date('2040-06-01'),
    checkOutDate: new Date('2040-06-03'),
    numNights: 2,
    numGuests: 1,
    cabinPrice: 200,
    totalPrice: 400,
    status,
  });
}
async function snapshot() {
  return JSON.stringify({
    cabins: await Cabin.find().sort({ _id: 1 }).lean(),
    bookings: await Booking.find().sort({ _id: 1 }).lean(),
    audits: await AuditLog.find().sort({ _id: 1 }).lean(),
  });
}

test.each([401, 403])(
  'returns authorization denial %i before parsing or database access',
  async status => {
    const error = createErrorResponse('Denied', status);
    jest
      .mocked(requireApiAuth)
      .mockResolvedValue({ authenticated: false, error });
    const input = request(['not-an-id']);
    const parse = jest.spyOn(input, 'json');
    expect(await POST(input)).toBe(error);
    expect(requireApiAuth).toHaveBeenCalledWith({ permission: 'cabins:write' });
    expect(parse).not.toHaveBeenCalled();
    expect(connectDB).not.toHaveBeenCalled();
  }
);

test.each<IBooking['status']>(['unconfirmed', 'confirmed', 'checked-in'])(
  'blocks all selected deletions when a cabin has a %s booking',
  async status => {
    const occupied = await createCabin();
    const empty = await createCabin('Empty cabin');
    await createBooking({ cabinId: occupied._id, status });
    const before = await snapshot();
    const response = await POST(
      request([String(occupied._id), String(empty._id)])
    );
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      success: false,
      error: 'Cannot delete cabins with active bookings: River cabin',
    });
    expect(await snapshot()).toBe(before);
  }
);

test('deduplicates populated names in booking encounter order', async () => {
  const first = await createCabin('Pine');
  const sameName = await createCabin('Pine');
  const other = await createCabin('Birch');
  await createBooking({ cabinId: first._id });
  await createBooking({ cabinId: sameName._id });
  await createBooking({ cabinId: other._id });
  await createBooking({ cabinId: first._id });
  const before = await snapshot();
  const response = await POST(
    request([String(other._id), String(sameName._id), String(first._id)])
  );
  expect(response.status).toBe(409);
  expect(await response.json()).toEqual({
    success: false,
    error: 'Cannot delete cabins with active bookings: Pine, Birch',
  });
  expect(await snapshot()).toBe(before);
});

test('keeps the Unknown fallback for deleted populated references', async () => {
  const missing = await createCabin('Deleted cabin');
  const empty = await createCabin('Empty cabin');
  await createBooking({ cabinId: missing._id });
  await Cabin.deleteOne({ _id: missing._id });
  const before = await snapshot();
  const response = await POST(
    request([String(missing._id), String(empty._id)])
  );
  expect(response.status).toBe(409);
  expect(await response.json()).toEqual({
    success: false,
    error: 'Cannot delete cabins with active bookings: Unknown',
  });
  expect(await snapshot()).toBe(before);
});

test('keeps the Unknown fallback for a sparse legacy cabin name', async () => {
  const cabin = await createCabin();
  await createBooking({ cabinId: cabin._id });
  await Cabin.collection.updateOne(
    { _id: cabin._id },
    { $unset: { name: '' } }
  );
  const before = await snapshot();
  const response = await POST(request([String(cabin._id)]));
  expect(response.status).toBe(409);
  expect(await response.json()).toEqual({
    success: false,
    error: 'Cannot delete cabins with active bookings: Unknown',
  });
  expect(await snapshot()).toBe(before);
});

test.each<IBooking['status']>(['cancelled', 'checked-out'])(
  'permits deletion with %s history, counts existing cabins once and retains bookings',
  async status => {
    const cabin = await createCabin();
    const unrelated = await createCabin('Unrelated occupied cabin');
    await createBooking({ cabinId: cabin._id, status });
    await createBooking({ cabinId: unrelated._id });
    const bookings = JSON.stringify(
      await Booking.find().sort({ _id: 1 }).lean()
    );
    const response = await POST(
      request([
        String(cabin._id),
        String(cabin._id),
        String(new Types.ObjectId()),
      ])
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      success: true,
      data: { deletedCount: 1 },
    });
    expect(await Cabin.findById(cabin._id)).toBeNull();
    expect(await Cabin.countDocuments()).toBe(1);
    expect(JSON.stringify(await Booking.find().sort({ _id: 1 }).lean())).toBe(
      bookings
    );
    const audit = await AuditLog.findOne().lean();
    expect(audit).toMatchObject({
      actor: 'user_manager',
      actorRole: 'manager',
      organizationId: 'org_bulk_delete',
      action: 'cabin.delete',
      resourceId: String(cabin._id),
      before: { name: 'River cabin', description: '[redacted]' },
    });
    expect(JSON.stringify(audit)).not.toContain('Private cabin description');
    expect(await AuditLog.countDocuments()).toBe(1);
  }
);

test('returns zero without auditing when none of the IDs exist', async () => {
  const response = await POST(request([String(new Types.ObjectId())]));
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({
    success: true,
    data: { deletedCount: 0 },
  });
  expect(await AuditLog.countDocuments()).toBe(0);
});
