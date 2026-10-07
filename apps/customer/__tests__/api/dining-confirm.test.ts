/** @jest-environment node */
import { Types } from 'mongoose';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ComponentProps, ReactElement } from 'react';
import type { DiningReservationConfirmationEmail } from '@/components/EmailTemplates';
const mockAuth = jest.fn();
const mockUser = jest.fn();
const mockConnect = jest.fn();
const mockPopulate = jest.fn();
const mockSend = jest.fn<
  Promise<{ data: { id: string } | null; error: { message: string } | null }>,
  [{ from: string; to: string; subject: string; react: ReactElement }]
>();
jest.mock('@clerk/nextjs/server', () => ({
  auth: () => mockAuth(),
  currentUser: () => mockUser(),
}));
jest.mock('@/lib/resend', () => ({
  getResend: () => ({ emails: { send: mockSend } }),
}));
jest.mock('@lodgeflow/database', () => ({
  connectDB: () => mockConnect(),
  DiningReservation: { findById: () => ({ populate: () => mockPopulate() }) },
}));
import { POST } from '@/app/api/send/dining-confirm/route';
const dining: ComponentProps<
  typeof DiningReservationConfirmationEmail
>['diningData'] = {
  name: 'Lake dinner',
  price: 25,
  mealType: 'dinner',
  servingTime: { start: '17:00', end: '22:00' },
};
const reservation = {
  _id: new Types.ObjectId('507f1f77bcf86cd799439011'),
  customer: 'owner',
  date: new Date('2040-01-01'),
  time: '18:00',
  numGuests: 2,
  isPaid: true,
  totalPrice: 50,
  dining,
};
const request = (body: unknown = { reservationId: String(reservation._id) }) =>
  new Request('https://customer.test', {
    method: 'POST',
    body: JSON.stringify(body),
  });
beforeEach(() => {
  jest.clearAllMocks();
  mockAuth.mockResolvedValue({ userId: 'owner' });
  mockUser.mockResolvedValue({
    firstName: 'Rae',
    emailAddresses: [{ emailAddress: 'guest@example.invalid' }],
  });
  mockConnect.mockResolvedValue(undefined);
  mockPopulate.mockResolvedValue(reservation);
  mockSend.mockResolvedValue({ data: { id: 'email' }, error: null });
});
test.each([0, 50])(
  'saved data and the %i sender retain their existing email contract',
  async totalPrice => {
    mockPopulate.mockResolvedValueOnce({ ...reservation, totalPrice });
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ id: 'email' });
    const sent = mockSend.mock.calls[0][0];
    expect(sent).toMatchObject({
      to: 'guest@example.invalid',
      subject: 'Dining Reservation Confirmation - LodgeFlow',
      from: `LodgeFlow <${totalPrice > 0 ? 'payments' : 'notifications'}@lodgeflow.app>`,
    });
    const html = renderToStaticMarkup(sent.react);
    expect(html).toContain('Lake dinner');
    expect(html).toContain('18:00');
  }
);
test.each([null, [], {}, { reservationId: [] }, { reservationId: 'invalid' }])(
  'invalid input is 400 before database/provider effects',
  async body => {
    expect((await POST(request(body))).status).toBe(400);
    expect(mockConnect).not.toHaveBeenCalled();
    expect(mockSend).not.toHaveBeenCalled();
  }
);
test('malformed JSON is a safe 400', async () => {
  expect(
    (
      await POST(
        new Request('https://customer.test', { method: 'POST', body: '{' })
      )
    ).status
  ).toBe(400);
  expect(mockConnect).not.toHaveBeenCalled();
});
test('auth denial precedes parsing', async () => {
  mockAuth.mockResolvedValueOnce({ userId: null });
  expect(
    (
      await POST(
        new Request('https://customer.test', { method: 'POST', body: '{' })
      )
    ).status
  ).toBe(401);
  expect(mockConnect).not.toHaveBeenCalled();
});
test('foreign reservation retains 403 before missing-catalog checks', async () => {
  mockPopulate.mockResolvedValueOnce({
    ...reservation,
    customer: 'foreign',
    dining: null,
  });
  expect((await POST(request())).status).toBe(403);
  expect(mockUser).not.toHaveBeenCalled();
  expect(mockSend).not.toHaveBeenCalled();
});
test('unpaid positive total retains 409', async () => {
  mockPopulate.mockResolvedValueOnce({ ...reservation, isPaid: false });
  expect((await POST(request())).status).toBe(409);
  expect(mockSend).not.toHaveBeenCalled();
});
test('missing dining is 404 without sending', async () => {
  mockPopulate.mockResolvedValueOnce({ ...reservation, dining: null });
  const response = await POST(request());
  expect(response.status).toBe(404);
  expect(await response.json()).toEqual({ error: 'Dining item not found' });
  expect(mockSend).not.toHaveBeenCalled();
});
test('provider rejection is safely contained', async () => {
  mockSend.mockResolvedValueOnce({
    data: null,
    error: { message: 'private provider detail' },
  });
  const response = await POST(request());
  expect(response.status).toBe(500);
  expect(await response.json()).toEqual({
    error: 'Failed to send confirmation email',
  });
});
test('unexpected auth failures are safely contained', async () => {
  mockAuth.mockRejectedValueOnce(new Error('private auth detail'));
  const response = await POST(request());
  expect(response.status).toBe(500);
  expect(await response.json()).toEqual({
    error: 'Failed to send confirmation email',
  });
});
