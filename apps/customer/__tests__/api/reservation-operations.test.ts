/** @jest-environment node */
import { NextRequest } from 'next/server';
import type {
  createDiningReservation,
  updateDiningReservation,
  createExperienceReservation,
  updateExperienceReservation,
} from '@lodgeflow/database';

import { Types } from 'mongoose';
import type {
  DiningReservationSource,
  ExperienceReservationSource,
} from '@lodgeflow/database/reservation-json';
const base = {
  _id: new Types.ObjectId('507f1f77bcf86cd7994390ac'),
  customer: 'owner',
  totalPrice: 50,
  isPaid: false,
  date: new Date('2030-06-01T18:00:00Z'),
  receipts: [],
  specialRequests: [],
};
const diningSource = {
  ...base,
  dining: null,
  time: '18:00',
  numGuests: 2,
  status: 'pending',
} satisfies DiningReservationSource & { dining: null };
const experienceSource = {
  ...base,
  experience: null,
  numParticipants: 2,
  status: 'pending',
} satisfies ExperienceReservationSource & { experience: null };
const diningResponse = { toObject: () => diningSource };
const experienceResponse = { toObject: () => experienceSource };
function json(value: unknown): unknown {
  return JSON.parse(JSON.stringify(value));
}
const mockAuth = jest.fn<Promise<{ userId: string | null }>, []>();
const mockConnect = jest.fn<Promise<void>, []>();
const mockCreateDining = jest.fn<
  Promise<typeof diningResponse>,
  Parameters<typeof createDiningReservation>
>();
const mockUpdateDining = jest.fn<
  Promise<typeof diningResponse>,
  Parameters<typeof updateDiningReservation>
>();
const mockCreateExperience = jest.fn<
  Promise<typeof experienceResponse>,
  Parameters<typeof createExperienceReservation>
>();
const mockUpdateExperience = jest.fn<
  Promise<typeof experienceResponse>,
  Parameters<typeof updateExperienceReservation>
>();
jest.mock('@clerk/nextjs/server', () => ({ auth: () => mockAuth() }));
jest.mock('@lodgeflow/database', () => ({
  connectDB: () => mockConnect(),
  createDiningReservation: (
    ...args: Parameters<typeof createDiningReservation>
  ) => mockCreateDining(...args),
  updateDiningReservation: (
    ...args: Parameters<typeof updateDiningReservation>
  ) => mockUpdateDining(...args),
  createExperienceReservation: (
    ...args: Parameters<typeof createExperienceReservation>
  ) => mockCreateExperience(...args),
  updateExperienceReservation: (
    ...args: Parameters<typeof updateExperienceReservation>
  ) => mockUpdateExperience(...args),
  ReservationRuleError: jest.requireActual(
    '@lodgeflow/database/reservation-capacity'
  ).ReservationRuleError,
}));
import { ReservationRuleError } from '@lodgeflow/database';
import { POST as diningPost } from '@/app/api/dining-reservations/route';
import {
  PATCH as diningPatch,
  DELETE as diningDelete,
} from '@/app/api/dining-reservations/[id]/route';
import { POST as experiencePost } from '@/app/api/experience-bookings/route';
import {
  PATCH as experiencePatch,
  DELETE as experienceDelete,
} from '@/app/api/experience-bookings/[id]/route';

const listingId = '507f1f77bcf86cd7994390ab';
const date = '2030-06-01T18:00:00Z';
const profiles = [
  {
    kind: 'dining',
    response: diningSource,
    post: diningPost,
    patch: diningPatch,
    remove: diningDelete,
    create: mockCreateDining,
    update: mockUpdateDining,
    body: { diningId: listingId, date, time: '18:00', numGuests: 2 },
    selection: {
      date: new Date(date),
      time: '18:00',
      numGuests: 2,
      specialRequests: [],
      dietaryRequirements: [],
      tablePreference: 'no-preference',
    },
  },
  {
    kind: 'experience',
    response: experienceSource,
    post: experiencePost,
    patch: experiencePatch,
    remove: experienceDelete,
    create: mockCreateExperience,
    update: mockUpdateExperience,
    body: { experienceId: listingId, date, numParticipants: 2 },
    selection: {
      date: new Date(date),
      numParticipants: 2,
      specialRequests: [],
    },
  },
] as const;
const params = { params: Promise.resolve({ id: '507f1f77bcf86cd7994390ac' }) };
function request({ method, body }: { method: string; body: string }) {
  return new NextRequest('http://localhost/api/reservation', { method, body });
}
beforeEach(() => {
  jest.resetAllMocks();
  mockAuth.mockResolvedValue({ userId: 'owner' });
  mockConnect.mockResolvedValue();
  mockCreateDining.mockResolvedValue(diningResponse);
  mockUpdateDining.mockResolvedValue(diningResponse);
  mockCreateExperience.mockResolvedValue(experienceResponse);
  mockUpdateExperience.mockResolvedValue(experienceResponse);
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

for (const profile of profiles) {
  describe(`${profile.kind} guest mutation boundary`, () => {
    const operations = [
      { method: 'POST', invoke: (input: NextRequest) => profile.post(input) },
      {
        method: 'PATCH',
        invoke: (input: NextRequest) => profile.patch(input, params),
      },
      {
        method: 'DELETE',
        invoke: (input: NextRequest) => profile.remove(input, params),
      },
    ];
    test.each(operations)(
      '$method authenticates before reading or connecting',
      async ({ method, invoke }) => {
        mockAuth.mockResolvedValueOnce({ userId: null });
        const input = request({ method, body: '{' });
        const read = jest.spyOn(input, 'text');
        const response = await invoke(input);
        expect(response.status).toBe(401);
        expect(await response.json()).toEqual({
          success: false,
          error: 'Authentication required',
        });
        expect(read).not.toHaveBeenCalled();
        expect(mockConnect).not.toHaveBeenCalled();
        expect(profile.create).not.toHaveBeenCalled();
        expect(profile.update).not.toHaveBeenCalled();
      }
    );
    test('POST derives owner and parsed selection, preserving the 201 JSON envelope', async () => {
      const response = await profile.post(
        request({
          method: 'POST',
          body: JSON.stringify({
            ...profile.body,
          }),
        })
      );
      expect(response.status).toBe(201);
      expect(await response.json()).toEqual({
        success: true,
        data: json(profile.response),
      });
      expect(mockConnect).toHaveBeenCalledTimes(1);
      expect(profile.create).toHaveBeenCalledWith({
        ...(profile.kind === 'dining'
          ? { diningId: listingId }
          : { experienceId: listingId }),
        customerId: 'owner',
        selection: profile.selection,
      });
      expect(profile.update).not.toHaveBeenCalled();
    });
    test('POST rejects invalid selection before connecting', async () => {
      const response = await profile.post(
        request({
          method: 'POST',
          body: JSON.stringify({ ...profile.body, date: 'invalid' }),
        })
      );
      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({ success: false });
      expect(mockConnect).not.toHaveBeenCalled();
      expect(profile.create).not.toHaveBeenCalled();
    });
    test('PATCH passes only selected fields and keeps its success message', async () => {
      const response = await profile.patch(
        request({
          method: 'PATCH',
          body: JSON.stringify({
            specialRequests: ['Window please'],
            date,
          }),
        }),
        params
      );
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({
        success: true,
        data: json(profile.response),
        message: 'Reservation updated successfully',
      });
      expect(profile.update).toHaveBeenCalledWith({
        reservationId: '507f1f77bcf86cd7994390ac',
        customerId: 'owner',
        action: 'update',
        updates: { specialRequests: ['Window please'], date: new Date(date) },
      });
      expect(profile.create).not.toHaveBeenCalled();
    });
    test('PATCH rejects invalid selection before connecting', async () => {
      const response = await profile.patch(
        request({ method: 'PATCH', body: '{"specialRequests":false}' }),
        params
      );
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({
        success: false,
        error: 'Invalid reservation details',
      });
      expect(mockConnect).not.toHaveBeenCalled();
      expect(profile.update).not.toHaveBeenCalled();
    });
    test('DELETE ignores the request body and keeps cancellation success', async () => {
      const input = request({ method: 'DELETE', body: '{' });
      const read = jest.spyOn(input, 'text');
      const response = await profile.remove(input, params);
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({
        success: true,
        data: json(profile.response),
        message: 'Reservation cancelled successfully',
      });
      expect(read).not.toHaveBeenCalled();
      expect(profile.update).toHaveBeenCalledWith({
        reservationId: '507f1f77bcf86cd7994390ac',
        customerId: 'owner',
        action: 'cancel',
      });
      expect(profile.create).not.toHaveBeenCalled();
    });
    test.each(operations)(
      '$method preserves typed denial and safe unexpected errors',
      async ({ method, invoke }) => {
        const mock = method === 'POST' ? profile.create : profile.update;
        for (const failure of [
          {
            error: new ReservationRuleError('Reservation not found', 404),
            status: 404,
            message: 'Reservation not found',
          },
          {
            error: new ReservationRuleError(
              'An online transaction is pending',
              409
            ),
            status: 409,
            message: 'An online transaction is pending',
          },
          {
            error: new Error('private database details'),
            status: 500,
            message:
              method === 'POST'
                ? 'Failed to create reservation'
                : 'Failed to change reservation',
          },
        ]) {
          mock.mockRejectedValueOnce(failure.error);
          const response = await invoke(
            request({
              method,
              body: JSON.stringify(method === 'POST' ? profile.body : {}),
            })
          );
          expect(response.status).toBe(failure.status);
          expect(await response.json()).toEqual({
            success: false,
            error: failure.message,
          });
        }
      }
    );
  });
}

for (const profile of profiles) {
  test.each(['POST', 'PATCH'])(
    `${profile.kind} %s rejects malformed JSON before effects`,
    async method => {
      const input = request({ method, body: '{' });
      const response =
        method === 'POST'
          ? await profile.post(input)
          : await profile.patch(input, params);
      expect(response.status).toBe(400);
      expect(mockConnect).not.toHaveBeenCalled();
      expect(profile.create).not.toHaveBeenCalled();
      expect(profile.update).not.toHaveBeenCalled();
    }
  );
  test.each([
    'customer',
    'totalPrice',
    'isPaid',
    'status',
    '$set',
    'checkout.pending',
  ])(`${profile.kind} rejects protected field %s`, async field => {
    for (const method of ['POST', 'PATCH']) {
      const input = request({
        method,
        body: JSON.stringify({
          ...(method === 'POST' ? profile.body : { specialRequests: [] }),
          [field]: 'forged',
        }),
      });
      const response =
        method === 'POST'
          ? await profile.post(input)
          : await profile.patch(input, params);
      expect(response.status).toBe(400);
      expect(mockConnect).not.toHaveBeenCalled();
      expect(profile.create).not.toHaveBeenCalled();
      expect(profile.update).not.toHaveBeenCalled();
    }
  });
}

for (const profile of profiles) {
  test(`${profile.kind} rejects prototype keys before effects`, async () => {
    const response = await profile.patch(
      request({
        method: 'PATCH',
        body: '{"__proto__":{},"specialRequests":[]}',
      }),
      params
    );
    expect(response.status).toBe(400);
    expect(mockConnect).not.toHaveBeenCalled();
    expect(profile.update).not.toHaveBeenCalled();
  });
}

for (const profile of profiles) {
  test(`${profile.kind} validates listing identifiers before connecting`, async () => {
    const body = {
      ...profile.body,
      [profile.kind === 'dining' ? 'diningId' : 'experienceId']: 'invalid',
    };
    const response = await profile.post(
      request({ method: 'POST', body: JSON.stringify(body) })
    );
    expect(response.status).toBe(400);
    expect(mockConnect).not.toHaveBeenCalled();
    expect(profile.create).not.toHaveBeenCalled();
  });
  test(`${profile.kind} invalid mutation IDs fail before connecting`, async () => {
    const response = await profile.patch(
      request({ method: 'PATCH', body: '{}' }),
      { params: Promise.resolve({ id: 'invalid' }) }
    );
    expect(response.status).toBe(404);
    expect(mockConnect).not.toHaveBeenCalled();
    expect(profile.update).not.toHaveBeenCalled();
  });
}

for (const profile of profiles) {
  test.each([null, 1893456000000, [], {}])(
    `${profile.kind} accepts only transport date strings: %j`,
    async dateValue => {
      const response = await profile.patch(
        request({ method: 'PATCH', body: JSON.stringify({ date: dateValue }) }),
        params
      );
      expect(response.status).toBe(400);
      expect(mockConnect).not.toHaveBeenCalled();
      expect(profile.update).not.toHaveBeenCalled();
    }
  );
}
