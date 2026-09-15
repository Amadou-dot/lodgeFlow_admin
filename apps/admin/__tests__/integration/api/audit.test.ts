import { NextRequest } from 'next/server';
import AuditLog from '@lodgeflow/database/models/AuditLog';
import Cabin from '@lodgeflow/database/models/Cabin';
import Booking from '@lodgeflow/database/models/Booking';
import { requireApiAuth, createErrorResponse } from '@/lib/api-utils';
import {
  auditSnapshot,
  auditDiff,
  BOOKING_AUDIT_FIELDS,
  recordAudit,
} from '@/lib/audit';
import { GET } from '@/app/api/audit/route';
import {
  POST as createCabin,
  PUT as updateCabin,
} from '@/app/api/cabins/route';
import { PATCH as patchBooking } from '@/app/api/bookings/[id]/route';
jest.mock('@lodgeflow/database/mongodb', () =>
  jest.fn().mockResolvedValue(undefined)
);
const access = {
  authenticated: true,
  userId: 'user_auditor',
  role: 'admin' as const,
};
const organizationId = 'org_lodgeflow';
const request = (path: string, method = 'GET', body?: unknown) =>
  new NextRequest('https://admin.test' + path, {
    method,
    ...(body
      ? {
          body: JSON.stringify(body),
          headers: { 'Content-Type': 'application/json' },
        }
      : {}),
  });
beforeEach(() => {
  process.env.LODGEFLOW_STAFF_ORG_ID = organizationId;
  (requireApiAuth as jest.Mock).mockResolvedValue(access);
});
afterEach(() => {
  delete process.env.LODGEFLOW_STAFF_ORG_ID;
  jest.restoreAllMocks();
});
const cabinData = {
  name: 'Audit cabin',
  description: 'Private text must be redacted',
  capacity: 4,
  price: 200,
  image: 'https://example.com/cabin.jpg',
};
it('records actual cabin changes, omits no-ops, and redacts free text', async () => {
  const response = await createCabin(request('/api/cabins', 'POST', cabinData));
  expect(response.status).toBe(201);
  const cabin = (await response.json()).data;
  const created = await AuditLog.findOne({ action: 'cabin.create' }).lean();
  expect(created?.actor).toBe(access.userId);
  expect(created?.actorRole).toBe('admin');
  expect(created?.after.description).toBe('[redacted]');
  expect(JSON.stringify(created)).not.toContain(cabinData.description);
  await updateCabin(
    request('/api/cabins', 'PUT', { _id: cabin._id, price: 240 })
  );
  const updated = await AuditLog.findOne({ action: 'cabin.update' }).lean();
  expect(updated?.before).toEqual({ price: 200 });
  expect(updated?.after).toEqual({ price: 240 });
  await updateCabin(
    request('/api/cabins', 'PUT', { _id: cabin._id, price: 240 })
  );
  expect(await AuditLog.countDocuments({ action: 'cabin.update' })).toBe(1);
  await updateCabin(
    request('/api/cabins', 'PUT', { _id: cabin._id, price: -1 })
  );
  expect(await AuditLog.countDocuments()).toBe(2);
});
it('records payment amount from the committed receipt and excludes guest notes', async () => {
  const cabin = await Cabin.create(cabinData);
  const booking = await Booking.create({
    cabin: cabin._id,
    customer: 'user_guest',
    checkInDate: new Date('2027-06-01'),
    checkOutDate: new Date('2027-06-03'),
    numNights: 2,
    numGuests: 1,
    cabinPrice: 400,
    totalPrice: 400,
    depositAmount: 100,
    payments: [],
    status: 'unconfirmed',
    observations: 'Sensitive guest note',
  });
  const response = await patchBooking(
    request('/api/bookings/' + booking.id, 'PATCH', {
      recordPayment: {
        paymentMethod: 'cash',
        amountPaid: 100,
        receiptId: '4e53edb3-90d1-4223-9503-4b10f64b7164',
        notes: 'Private payment note',
      },
    }),
    { params: Promise.resolve({ id: booking.id }) }
  );
  expect(response?.status).toBe(200);
  const event = await AuditLog.findOne({ action: 'payment.record' }).lean();
  expect(event?.before.amountPaid).toBe(0);
  expect(event?.after.amountPaid).toBe(100);
  expect(event?.after.remainingAmount).toBe(300);
  expect(JSON.stringify(event)).not.toMatch(
    /Sensitive guest note|Private payment note/
  );
});
it('limits history to the trusted organization and supports filters and pagination', async () => {
  await AuditLog.create([
    {
      organizationId,
      actor: 'user_one',
      actorRole: 'admin',
      action: 'staff.role_change',
      resourceType: 'staff',
      resourceId: 'user_target',
      before: { role: null },
      after: { role: 'manager' },
      createdAt: new Date('2026-09-01'),
    },
    {
      organizationId,
      actor: 'user_two',
      actorRole: 'manager',
      action: 'cabin.update',
      resourceType: 'cabin',
      resourceId: 'cabin_one',
      before: { price: 1 },
      after: { price: 2 },
      createdAt: new Date('2026-09-02'),
    },
    {
      organizationId: 'org_other',
      actor: 'user_one',
      actorRole: 'admin',
      action: 'staff.role_change',
      resourceType: 'staff',
      resourceId: 'user_target',
      before: {},
      after: { role: 'admin' },
    },
  ]);
  const first = await (await GET(request('/api/audit?limit=1')))!.json();
  expect(first.data.total).toBe(2);
  expect(first.data.events[0].actor).toBe('user_two');
  const filtered = await (await GET(
    request(
      '/api/audit?actor=user_one&action=staff.role_change&resourceId=user_target&from=2026-09-01&to=2026-09-01T23:59:59Z'
    )
  ))!.json();
  expect(filtered.data.total).toBe(1);
  expect((await GET(request('/api/audit?from=not-a-date')))?.status).toBe(400);
  expect((await GET(request('/api/audit?limit=1000')))?.status).toBe(400);
  expect((await GET(request('/api/audit?action=unknown')))?.status).toBe(400);
});
it('requires audit:read before accessing history', async () => {
  (requireApiAuth as jest.Mock).mockResolvedValue({
    authenticated: false,
    error: createErrorResponse('Forbidden', 403),
  });
  expect((await GET(request('/api/audit')))?.status).toBe(403);
  expect(requireApiAuth).toHaveBeenCalledWith({ permission: 'audit:read' });
});
it('does not roll back a successful mutation when audit persistence fails', async () => {
  jest
    .spyOn(AuditLog, 'create')
    .mockRejectedValue(new Error('audit unavailable') as never);
  const response = await createCabin(request('/api/cabins', 'POST', cabinData));
  expect(response.status).toBe(201);
  expect(await Cabin.countDocuments()).toBe(1);
});
it('keeps detached business-only snapshots and has no TTL index', async () => {
  const source = { amountPaid: 2, observations: 'secret', passport: 'secret' };
  const snapshot = auditSnapshot(source, BOOKING_AUDIT_FIELDS);
  source.amountPaid = 3;
  expect(snapshot.amountPaid).toBe(2);
  expect(snapshot).not.toHaveProperty('observations');
  expect(auditDiff({ amountPaid: 2 }, { amountPaid: 2 })).toEqual({
    before: {},
    after: {},
  });
  await AuditLog.init();
  expect(
    (await AuditLog.collection.indexes()).some(
      index => index.expireAfterSeconds !== undefined
    )
  ).toBe(false);
  await recordAudit(
    { authenticated: false },
    {
      action: 'staff.role_change',
      resourceType: 'staff',
      resourceId: 'user_target',
      before: { role: null },
      after: { role: 'admin' },
    }
  );
  expect(await AuditLog.countDocuments()).toBe(0);
});
