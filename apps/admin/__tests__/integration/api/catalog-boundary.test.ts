import { NextRequest } from 'next/server';
import mongoose from 'mongoose';
import { Cabin, Dining, Experience } from '@lodgeflow/database';
import connectDB from '@lodgeflow/database/mongodb';
import { createErrorResponse, requireApiAuth } from '@/lib/api-utils';
import {
  POST as createCabin,
  PUT as updateCabin,
} from '@/app/api/cabins/route';
import {
  PUT as updateCabinById,
  GET as getCabin,
} from '@/app/api/cabins/[id]/route';
import {
  POST as createDining,
  PUT as updateDining,
} from '@/app/api/dining/route';
import {
  PUT as updateDiningById,
  GET as getDining,
} from '@/app/api/dining/[id]/route';
import { POST as createExperience } from '@/app/api/experiences/route';
import {
  PUT as updateExperience,
  GET as getExperience,
} from '@/app/api/experiences/[id]/route';
jest.mock('@lodgeflow/database/mongodb', () =>
  jest.fn().mockResolvedValue(undefined)
);
const id = '507f1f77bcf86cd7994390ab';
const params = { params: Promise.resolve({ id }) };
const req = (body: string) =>
  new NextRequest('https://admin.test', { method: 'POST', body });
const mutations = [
  ['cabin create', (r: NextRequest) => createCabin(r)],
  ['cabin update', (r: NextRequest) => updateCabin(r)],
  ['cabin path update', (r: NextRequest) => updateCabinById(r, params)],
  ['dining create', (r: NextRequest) => createDining(r)],
  ['dining update', (r: NextRequest) => updateDining(r)],
  ['dining path update', (r: NextRequest) => updateDiningById(r, params)],
  ['experience create', (r: NextRequest) => createExperience(r)],
  ['experience update', (r: NextRequest) => updateExperience(r, params)],
] as const;

test('preserves field validation status without returning database values or properties', async () => {
  const failure = new mongoose.Error.ValidationError();
  failure.addError(
    'name',
    new mongoose.Error.ValidatorError({
      path: 'name',
      value: 'private stored value',
      message: 'private database failure',
      type: 'required',
    })
  );
  const create = jest.spyOn(Cabin, 'create').mockRejectedValueOnce(failure);
  try {
    const response = await createCabin(
      req(
        JSON.stringify({
          name: 'Pine',
          description: 'A quiet forest cabin',
          image: 'https://example.test/pine.jpg',
          capacity: 4,
          price: 100,
          discount: 0,
          amenities: [],
        })
      )
    );
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body).toMatchObject({
      success: false,
      details: { name: { message: 'Invalid value', path: 'name' } },
    });
    expect(JSON.stringify(body)).not.toContain('private');
  } finally {
    create.mockRestore();
  }
});
beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(requireApiAuth).mockResolvedValue({
    authenticated: true,
    userId: 'user_staff',
    role: 'manager',
  });
});
test.each(mutations)(
  '%s denies access before parsing or connecting',
  async (_name, invoke) => {
    jest.mocked(requireApiAuth).mockResolvedValueOnce({
      authenticated: false,
      error: createErrorResponse('Permission denied', 403),
    });
    const input = req('{');
    const read = jest.spyOn(input, 'text');
    expect((await invoke(input)).status).toBe(403);
    expect(read).not.toHaveBeenCalled();
    expect(connectDB).not.toHaveBeenCalled();
  }
);
test.each(mutations)(
  '%s rejects malformed JSON before connecting',
  async (_name, invoke) => {
    expect((await invoke(req('{'))).status).toBe(400);
    expect(connectDB).not.toHaveBeenCalled();
  }
);
test.each(mutations)(
  '%s rejects a non-object payload before connecting',
  async (_name, invoke) => {
    for (const body of ['null', '[]', 'true']) {
      expect((await invoke(req(body))).status).toBe(400);
      expect(connectDB).not.toHaveBeenCalled();
    }
  }
);
test.each([getCabin, getDining, getExperience])(
  'invalid catalog detail IDs fail before connecting',
  async read => {
    const response = await read(req('{}'), {
      params: Promise.resolve({ id: 'invalid' }),
    });
    expect(response.status).toBe(400);
    expect(connectDB).not.toHaveBeenCalled();
  }
);
const createInputs = [
  {
    kind: 'cabin',
    invoke: createCabin,
    data: {
      name: 'Cabin',
      description: 'A valid description',
      image: 'https://example.invalid/a.jpg',
      capacity: 4,
      price: 100,
    },
  },
  {
    kind: 'dining',
    invoke: createDining,
    data: {
      name: 'Dinner',
      description: 'A valid description',
      image: 'https://example.invalid/d.jpg',
      price: 20,
      type: 'menu',
      mealType: 'dinner',
      category: 'regular',
      servingTime: { start: '17:00', end: '22:00' },
      maxPeople: 4,
    },
  },
  {
    kind: 'experience',
    invoke: createExperience,
    data: {
      name: 'Hike',
      description: 'A valid description',
      image: 'https://example.invalid/e.jpg',
      price: 20,
      duration: '2h',
      difficulty: 'Easy',
      category: 'Outdoor',
      includes: ['Guide'],
      available: ['Monday'],
      ctaText: 'Book',
    },
  },
] as const;
test.each(createInputs)(
  '$kind rejects protected catalog fields before effects',
  async ({ invoke, data }) => {
    for (const field of [
      'createdAt',
      'updatedAt',
      '__v',
      'reservationVersion',
      '$set',
      'name.value',
      '__proto__',
    ]) {
      const body =
        field === '__proto__'
          ? JSON.stringify(data).slice(0, -1) + ',"__proto__":"forged"}'
          : JSON.stringify({ ...data, [field]: 'forged' });
      const response = await invoke(req(body));
      expect(response.status).toBe(400);
      expect(connectDB).not.toHaveBeenCalled();
      expect(await Cabin.countDocuments()).toBe(0);
      expect(await Dining.countDocuments()).toBe(0);
      expect(await Experience.countDocuments()).toBe(0);
    }
  }
);
test('dining payload-only count bounds reject impossible create ranges before connection', async () => {
  const { data, invoke } = createInputs[1];
  const response = await invoke(
    req(JSON.stringify({ ...data, minPeople: 5, maxPeople: 4 }))
  );
  expect(response.status).toBe(400);
  expect(connectDB).not.toHaveBeenCalled();
});

test.each(['collection', 'detail'])(
  'dining %s updates reject partial party-size conflicts without writes',
  async endpoint => {
    const dining = await Dining.create({
      ...createInputs[1].data,
      minPeople: 2,
    });
    const listingId = String(dining._id);
    const before = await Dining.findById(listingId)
      .select('+reservationVersion')
      .lean();
    for (const updates of [{ minPeople: 5 }, { maxPeople: 1 }]) {
      const input = new NextRequest('https://admin.test/api/dining', {
        method: 'PUT',
        body: JSON.stringify({
          ...(endpoint === 'collection' ? { _id: listingId } : {}),
          ...updates,
          name: 'Must roll back',
        }),
      });
      const response =
        endpoint === 'collection'
          ? await updateDining(input)
          : await updateDiningById(input, {
              params: Promise.resolve({ id: listingId }),
            });
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({
        success: false,
        error: 'Minimum guests cannot exceed maximum guests',
      });
      expect(
        await Dining.findById(listingId).select('+reservationVersion').lean()
      ).toEqual(before);
    }
  }
);

test.each(mutations)(
  '%s rejects explicit prototype keys without a server failure',
  async (_name, invoke) => {
    const response = await invoke(
      req(
        '{"_id":"507f1f77bcf86cd7994390ab","name":"Changed","__proto__":{"polluted":true}}'
      )
    );
    expect(response.status).toBe(400);
    expect(connectDB).not.toHaveBeenCalled();
  }
);
