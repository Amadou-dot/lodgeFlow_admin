/** @jest-environment node */
import {
  createBookingSchema,
  updateBookingDetailsSchema,
} from '@/lib/validations/booking';
import {
  createDiningReservationSchema,
  updateDiningDetailsSchema,
} from '@/lib/validations/dining-reservation';
import {
  createExperienceBookingSchema,
  updateExperienceDetailsSchema,
} from '@/lib/validations/experience-booking';

const id = '507f1f77bcf86cd799439011';
const dates = {
  checkInDate: '2040-01-01',
  checkOutDate: '2040-01-03',
  numGuests: 2,
};

const cases = [
  {
    name: 'cabin create',
    schema: createBookingSchema,
    input: { cabinId: id, ...dates },
    field: 'specialRequests' as const,
  },
  {
    name: 'cabin update',
    schema: updateBookingDetailsSchema,
    input: {},
    field: 'specialRequests' as const,
  },
  {
    name: 'experience create',
    schema: createExperienceBookingSchema,
    input: { experienceId: id, date: '2040-01-01', numParticipants: 2 },
    field: 'specialRequests' as const,
  },
  {
    name: 'experience update',
    schema: updateExperienceDetailsSchema,
    input: {},
    field: 'specialRequests' as const,
  },
  ...(['specialRequests', 'dietaryRequirements'] as const).flatMap(field => [
    {
      name: `dining create ${field}`,
      schema: createDiningReservationSchema,
      input: { diningId: id, date: '2040-01-01', time: '12:00', numGuests: 2 },
      field,
    },
    {
      name: `dining update ${field}`,
      schema: updateDiningDetailsSchema,
      input: {},
      field,
    },
  ]),
];

describe.each(cases)('$name', ({ schema, input, field }) => {
  test('retains normal text, empty lists and the generous boundary', () => {
    for (const notes of [
      [],
      ['Early check-in', 'Allergy: nuts'],
      Array(100).fill('a'.repeat(1000)),
    ]) {
      const result = schema.safeParse({ ...input, [field]: notes });
      expect(result.success).toBe(true);
      if (result.success) expect(result.data).toMatchObject({ [field]: notes });
    }
  });
  test('rejects one extra entry', () => {
    expect(
      schema.safeParse({ ...input, [field]: Array(101).fill('Note') }).success
    ).toBe(false);
  });
  test('rejects one overlong entry', () => {
    expect(
      schema.safeParse({ ...input, [field]: ['a'.repeat(1001)] }).success
    ).toBe(false);
  });
  test('rejects an oversized invalid list without per-item issues', () => {
    const result = schema.safeParse({
      ...input,
      [field]: Array(1000).fill(null),
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toHaveLength(1);
      expect(result.error.issues[0]).toMatchObject({
        code: 'too_big',
        path: [field],
      });
    }
  });
});
