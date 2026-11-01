import { createErrorResponse, createSuccessResponse } from '@/lib/api-utils';

jest.mock('@clerk/nextjs/server', () => ({ auth: jest.fn() }));
jest.mock('@/lib/staff-access', () => ({ resolveStaffRole: jest.fn() }));
jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn() },
}));

test.each([
  { label: 'null', data: null },
  { label: 'zero', data: 0 },
  { label: 'false', data: false },
  { label: 'empty string', data: '' },
  { label: 'empty list', data: [] },
])('success keeps $label data and omits an empty message', async ({ data }) => {
  const response = createSuccessResponse(data, '', 201);
  expect(response.status).toBe(201);
  expect(await response.json()).toEqual({ success: true, data });
});

test.each([null, 0, false, ''])(
  'error preserves supplied falsy details: %p',
  async details => {
    const response = createErrorResponse('Rejected', 409, details);
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      success: false,
      error: 'Rejected',
      details,
    });
  }
);

test('error omits absent details and success-only fields', async () => {
  const response = createErrorResponse('Rejected', 403, undefined);
  expect(response.status).toBe(403);
  expect(await response.json()).toEqual({ success: false, error: 'Rejected' });
});
