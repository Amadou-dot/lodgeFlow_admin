/** @jest-environment node */
import { Types } from 'mongoose';
import DiningReservation from '@lodgeflow/database/models/DiningReservation';
import ExperienceBooking from '@lodgeflow/database/models/ExperienceBooking';
import {
  decodeDiningDetail,
  decodeExperienceDetail,
  decodeDiningHistory,
  decodeExperienceHistory,
} from '@/lib/validations/reservation-read-json';
import { NextRequest } from 'next/server';
import { logger } from '@lodgeflow/database/logger';
const mockAuth = jest.fn();
const mockConnect = jest.fn();
const mockLean = jest.fn<Promise<unknown[]>, []>();
const mockPopulate = jest.fn<Promise<unknown>, []>();
const mockFind = jest.fn(() => ({
  populate: () => ({ sort: () => ({ lean: mockLean }) }),
}));
const mockFindById = jest.fn(() => ({ populate: mockPopulate }));
jest.mock('@clerk/nextjs/server', () => ({ auth: () => mockAuth() }));
jest.mock('@lodgeflow/database', () => ({
  connectDB: () => mockConnect(),
  DiningReservation: { find: () => mockFind(), findById: () => mockFindById() },
  ExperienceBooking: { find: () => mockFind(), findById: () => mockFindById() },
}));
import { GET as diningList } from '@/app/api/dining-reservations/route';
import { GET as diningHistory } from '@/app/api/dining-reservations/history/route';
import { GET as experienceList } from '@/app/api/experience-bookings/route';
import { GET as experienceHistory } from '@/app/api/experience-bookings/history/route';
import { GET as diningDetail } from '@/app/api/dining-reservations/[id]/route';
import { GET as experienceDetail } from '@/app/api/experience-bookings/[id]/route';
beforeEach(() => {
  jest.clearAllMocks();
  mockLean.mockResolvedValue([]);
  mockPopulate.mockResolvedValue(null);
  mockAuth.mockResolvedValue({ userId: 'owner' });
  mockConnect.mockResolvedValue(undefined);
});
afterEach(() => jest.restoreAllMocks());
for (const route of [
  diningList,
  diningHistory,
  experienceList,
  experienceHistory,
]) {
  test('empty collection/history preserves its success envelope', async () => {
    const response = await route(
      new NextRequest('https://customer.test/api/reservations')
    );
    expect(await response.json()).toEqual({ success: true, data: [] });
  });
  test('invalid status fails before connecting or reading', async () => {
    const response = await route(
      new NextRequest('https://customer.test/api/reservations?status=bogus')
    );
    expect(response.status).toBe(400);
    expect(mockConnect).not.toHaveBeenCalled();
    expect(mockFind).not.toHaveBeenCalled();
  });
  test('denied collection/history reads cannot reach the database', async () => {
    mockAuth.mockResolvedValueOnce({ userId: null });
    expect((await route(new NextRequest('https://customer.test'))).status).toBe(
      401
    );
    expect(mockConnect).not.toHaveBeenCalled();
    expect(mockFind).not.toHaveBeenCalled();
  });
  test('unexpected read failures are safely logged', async () => {
    const failure = new Error('private database detail');
    const log = jest.spyOn(logger, 'error').mockImplementation(() => undefined);
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    mockConnect.mockRejectedValueOnce(failure);
    const response = await route(new NextRequest('https://customer.test'));
    expect(response.status).toBe(500);
    expect(JSON.stringify(await response.json())).not.toContain('private');
    expect(log).toHaveBeenCalledWith(expect.any(String), failure);
  });
}
for (const route of [diningDetail, experienceDetail]) {
  test('invalid detail IDs fail without a database read', async () => {
    const response = await route(new NextRequest('https://customer.test'), {
      params: Promise.resolve({ id: 'invalid' }),
    });
    expect(response.status).toBe(404);
    expect(mockConnect).not.toHaveBeenCalled();
    expect(mockFindById).not.toHaveBeenCalled();
  });
}

const date = new Date('+010000-06-01T00:00:00.000Z');
const mongoId = new Types.ObjectId('507f1f77bcf86cd7994390ab');
const common = {
  _id: mongoId,
  customer: 'owner',
  date,
  totalPrice: 25.005,
  checkout: null,
  stripeRefund: null,
  specialRequests: null,
  paymentConfirmationSentAt: null,
  createdAt: date,
  updatedAt: null,
};
const receipt = {
  id: 'historical',
  type: 'payment',
  method: 'cash',
  actor: 'staff',
  amountCents: 1.5,
  reference: '',
  recordedAt: date,
};
for (const kind of ['dining', 'experience'] as const) {
  const isDining = kind === 'dining';
  const decodeHistory = isDining
    ? decodeDiningHistory
    : decodeExperienceHistory;
  const decodeDetail = isDining ? decodeDiningDetail : decodeExperienceDetail;
  const detailRoute = isDining ? diningDetail : experienceDetail;
  const historyRoute = isDining ? diningHistory : experienceHistory;
  const fields = isDining
    ? { time: '19:00', numGuests: 1, dietaryRequirements: [null, 'Vegetarian'] }
    : { numParticipants: 1, timeSlot: null };
  const projected = isDining
    ? {
        _id: mongoId,
        name: 'Meal',
        price: 12.345,
        image: '/meal',
        type: 'menu',
        mealType: 'dinner',
        servingTime: { start: 'Noon', end: 'Late' },
        maxPeople: 4.5,
      }
    : {
        _id: mongoId,
        name: 'Walk',
        price: 12.345,
        image: '/walk',
        duration: 'Half day',
        category: 'Local',
      };
  test(
    kind +
      ' history accepts its selected catalog and preserves absent lean defaults and raw receipt cents',
    async () => {
      const row = {
        ...common,
        ...fields,
        [kind]: projected,
        receipts: [receipt],
      };
      mockLean.mockResolvedValue([
        row,
        { ...row, receipts: undefined, [kind]: null },
      ]);
      const response = await historyRoute(
        new NextRequest('https://customer.test')
      );
      const body = await response.json();
      expect(response.status).toBe(200);
      expect(body.data[0]).toMatchObject({
        specialRequests: null,
        checkout: null,
        receipts: [{ amountCents: 1.5, reference: '' }],
        [kind]: { _id: mongoId.toHexString(), price: 12.345 },
      });
      expect(body.data[0]).not.toHaveProperty('status');
      expect(body.data[1]).not.toHaveProperty('receipts');
      expect(decodeHistory(body)).toBe(body.data);
      expect(
        decodeDetail(mongoId.toHexString())({
          success: true,
          data: body.data[0],
        })
      ).toBeUndefined();
      expect(
        decodeHistory({
          success: true,
          data: [
            {
              ...body.data[0],
              receipts: [{ ...body.data[0].receipts[0], recordedAt: 3 }],
            },
          ],
        })
      ).toBeUndefined();
    }
  );
  test(
    kind +
      ' GET preserves hydrated null status and raw stored payment fields without computing a summary',
    async () => {
      const saved = {
        ...common,
        ...fields,
        status: null,
        isPaid: null,
        [kind]: null,
        receipts: [
          receipt,
          { ...receipt, id: 'large', amountCents: Number.MAX_SAFE_INTEGER },
        ],
      };
      mockPopulate.mockResolvedValue(
        isDining
          ? DiningReservation.hydrate(saved)
          : ExperienceBooking.hydrate(saved)
      );
      const id = mongoId.toHexString().toUpperCase();
      const response = await detailRoute(
        new NextRequest('https://customer.test'),
        { params: Promise.resolve({ id }) }
      );
      const body = await response.json();
      expect(response.status).toBe(200);
      expect(body.data).toMatchObject({
        id: mongoId.toHexString(),
        [kind]: null,
        status: null,
        isPaid: null,
        specialRequests: null,
        checkout: null,
        stripeRefund: null,
        receipts: [
          { amountCents: 1.5, reference: '' },
          { amountCents: Number.MAX_SAFE_INTEGER },
        ],
      });
      expect(decodeDetail(id)(body)).toBe(body.data);
      expect(
        decodeDetail(id)({
          ...body,
          data: { ...body.data, id: '507f1f77bcf86cd7994390bb' },
        })
      ).toBeUndefined();
      const additions = {
        ...body.data,
        receipts: [{ ...body.data.receipts[0], annotation: 'preserved' }],
      };
      expect(decodeDetail(id)({ ...body, data: additions })).toBe(additions);
    }
  );
}
