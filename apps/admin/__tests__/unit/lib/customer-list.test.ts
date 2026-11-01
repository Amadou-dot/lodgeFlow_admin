import { fetchCustomersList } from '@/lib/customer-list';
import { isCustomersSuccessResponse } from '@/lib/validations/customer-list';
import { customerJsonFixture } from '../../setup/customer-json';

const body = {
  success: true,
  data: [customerJsonFixture],
  pagination: {
    currentPage: 1,
    totalPages: 1,
    totalCustomers: 1,
    limit: 20,
    hasNextPage: false,
    hasPrevPage: false,
  },
};

test.each([
  { label: 'missing data', value: { ...body, data: undefined } },
  { label: 'null data', value: { ...body, data: null } },
  { label: 'object data', value: { ...body, data: {} } },
  { label: 'primitive row', value: { ...body, data: ['guest'] } },
  { label: 'null row', value: { ...body, data: [null] } },
  { label: 'missing pagination', value: { ...body, pagination: undefined } },
  { label: 'null pagination', value: { ...body, pagination: null } },
  { label: 'non-string message', value: { ...body, message: 123 } },
  { label: 'array envelope', value: [body] },
  {
    label: 'invalid optional booking',
    value: {
      ...body,
      data: [{ ...customerJsonFixture, recentBookings: [{}] }],
    },
  },
])('rejects $label without a type assertion', ({ value }) => {
  expect(isCustomersSuccessResponse(value)).toBe(false);
});

test('validation retains original additive fields and finite legacy amounts', () => {
  const value: unknown = {
    ...body,
    data: [
      { ...customerJsonFixture, totalSpent: -0.123, extra: { retained: true } },
    ],
    extraEnvelope: true,
  };
  expect(isCustomersSuccessResponse(value)).toBe(true);
  if (!isCustomersSuccessResponse(value))
    throw new Error('Expected valid fixture');
  expect(value.data[0].created_at).toBe(customerJsonFixture.created_at);
  expect(value.data[0].totalSpent).toBe(-0.123);
  expect(value.data[0]).toHaveProperty('extra.retained', true);
  expect(value).toHaveProperty('extraEnvelope', true);
});

const originalFetch = global.fetch;
const fetchMock = jest.fn<Promise<Response>, Parameters<typeof fetch>>();
beforeEach(() => {
  fetchMock.mockReset();
  global.fetch = fetchMock;
});
afterEach(() => {
  global.fetch = originalFetch;
});

test('HTTP failure never reads or exposes its body', async () => {
  const response = new Response('private provider details', { status: 503 });
  const json = jest.spyOn(response, 'json');
  fetchMock.mockResolvedValue(response);
  await expect(fetchCustomersList('/api/customers?')).rejects.toThrow(
    'Failed to fetch customers'
  );
  expect(json).not.toHaveBeenCalled();
});

test('valid responses are read once and keep the supplied request URL', async () => {
  const response = Response.json(body);
  const json = jest.spyOn(response, 'json');
  fetchMock.mockResolvedValue(response);
  const url = '/api/customers?page=3&limit=20&search=Jane%20Guest';
  expect(await fetchCustomersList(url)).toEqual(body);
  expect(fetchMock).toHaveBeenCalledWith(url);
  expect(json).toHaveBeenCalledTimes(1);
});
