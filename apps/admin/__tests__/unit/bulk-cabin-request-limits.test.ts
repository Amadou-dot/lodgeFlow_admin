import {
  bulkCabinSchema,
  readBulkCabinRequest,
} from '@/lib/validations/bulk-cabin';

const id = '507f1f77bcf86cd799439011';
const request = (body: unknown) =>
  new Request('https://admin.lodgeflow.test/api/cabins/bulk', {
    method: 'POST',
    body: JSON.stringify(body),
  });

const required = 'action and ids (non-empty array) are required';

test.each([
  {
    name: '51 valid IDs',
    body: { action: 'delete', ids: Array(51).fill(id) },
    error: 'Cannot process more than 50 items at once',
  },
  {
    name: '51 invalid IDs',
    body: { action: 'delete', ids: Array(51).fill('bad') },
    error: 'Cannot process more than 50 items at once',
  },
  {
    name: '50 IDs with an invalid entry',
    body: { action: 'delete', ids: [...Array(49).fill(id), 'bad'] },
    error: 'Each id must be a valid ObjectId string',
  },
  {
    name: 'missing action and too many IDs',
    body: { ids: Array(51).fill(id) },
    error: required,
  },
  { name: 'empty IDs', body: { action: 'delete', ids: [] }, error: required },
  {
    name: 'non-array IDs',
    body: { action: 'delete', ids: id },
    error: required,
  },
])('$name keeps bounded error precedence', async ({ body, error }) => {
  expect(await readBulkCabinRequest(request(body))).toEqual({
    success: false,
    error,
  });
});

test('rejects oversized bulk collections without accessing their elements', () => {
  const ids: unknown[] = Array(51).fill(id);
  Object.defineProperty(ids, 0, {
    get() {
      throw new Error('Element must not be read');
    },
  });
  const result = bulkCabinSchema.safeParse({ action: 'delete', ids });
  expect(result.success).toBe(false);
  if (!result.success)
    expect(result.error.issues).toEqual([
      expect.objectContaining({ code: 'too_big', path: ['ids'] }),
    ]);
});
