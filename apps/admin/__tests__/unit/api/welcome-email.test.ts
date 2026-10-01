import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ReactElement } from 'react';
import { createErrorResponse, requireApiAuth } from '@/lib/api-utils';
import { checkRateLimit, RATE_LIMIT_CONFIGS } from '@/lib/rate-limit';

const mockAuth = jest.fn<
  ReturnType<typeof requireApiAuth>,
  Parameters<typeof requireApiAuth>
>();
const mockRateLimit = jest.fn<
  ReturnType<typeof checkRateLimit>,
  Parameters<typeof checkRateLimit>
>();
interface EmailInput {
  from: string;
  to: string;
  subject: string;
  react: ReactElement;
}
type SendResult =
  | { data: { id: string }; error: null }
  | { data: null; error: { name: string; message: string } };
const mockSend = jest.fn<Promise<SendResult>, [EmailInput]>();
const mockGetResend = jest.fn(() => ({ emails: { send: mockSend } }));
jest.mock('@clerk/nextjs/server', () => ({ auth: jest.fn() }));
jest.mock('@/lib/staff-access', () => ({ resolveStaffRole: jest.fn() }));
jest.mock('@/lib/api-utils', () => ({
  ...jest.requireActual<typeof import('@/lib/api-utils')>('@/lib/api-utils'),
  requireApiAuth: (...args: Parameters<typeof requireApiAuth>) =>
    mockAuth(...args),
}));
jest.mock('@/lib/rate-limit', () => ({
  ...jest.requireActual<typeof import('@/lib/rate-limit')>('@/lib/rate-limit'),
  checkRateLimit: (...args: Parameters<typeof checkRateLimit>) =>
    mockRateLimit(...args),
}));
jest.mock('@/lib/resend', () => ({ getResend: () => mockGetResend() }));
import { POST } from '@/app/api/send/welcome/route';

const originalSender = process.env.LODGEFLOW_NOTIFICATION_EMAIL_FROM;
const payload = { firstName: 'Rae & Finch', email: 'UPPER@Example.invalid' };
function request(body: unknown = payload) {
  return new Request('https://admin.test/api/send/welcome', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}
async function invoke(input: Request = request()) {
  const response = await POST(input);
  assert(response);
  return response;
}
beforeEach(() => {
  jest.resetAllMocks();
  delete process.env.LODGEFLOW_NOTIFICATION_EMAIL_FROM;
  jest.spyOn(Date, 'now').mockReturnValue(1700000000000);
  mockAuth.mockResolvedValue({
    authenticated: true,
    userId: 'administrator',
    role: 'admin',
  });
  mockRateLimit.mockResolvedValue({
    success: true,
    limit: 5,
    remaining: 4,
    resetTime: Date.now() + 30000,
  });
  mockGetResend.mockReturnValue({ emails: { send: mockSend } });
  mockSend.mockResolvedValue({ data: { id: 'admin-welcome' }, error: null });
});
afterEach(() => {
  if (originalSender === undefined)
    delete process.env.LODGEFLOW_NOTIFICATION_EMAIL_FROM;
  else process.env.LODGEFLOW_NOTIFICATION_EMAIL_FROM = originalSender;
  jest.restoreAllMocks();
});

describe('admin welcome characterization', () => {
  test.each([401, 403])(
    'preserves auth denial %i before body/rate-limit/provider work',
    async status => {
      const denied = createErrorResponse('Denied', status);
      mockAuth.mockResolvedValue({ authenticated: false, error: denied });
      const input = request();
      const parse = jest.spyOn(input, 'json');
      expect(await invoke(input)).toBe(denied);
      expect(mockAuth.mock.calls).toEqual([[]]);
      expect(mockRateLimit).not.toHaveBeenCalled();
      expect(parse).not.toHaveBeenCalled();
      expect(mockGetResend).not.toHaveBeenCalled();
      expect(mockSend).not.toHaveBeenCalled();
    }
  );

  test('preserves the 429 body and retry headers before parsing or sending', async () => {
    mockRateLimit.mockResolvedValue({
      success: false,
      limit: 5,
      remaining: 0,
      resetTime: Date.now() + 30000,
    });
    const input = request();
    const parse = jest.spyOn(input, 'json');
    const response = await invoke(input);
    expect(response.status).toBe(429);
    expect(await response.json()).toEqual({
      success: false,
      error: 'Too many requests. Please try again later.',
      retryAfter: 30,
    });
    expect(response.headers.get('Retry-After')).toBe('30');
    expect(response.headers.get('X-RateLimit-Reset')).toBe(
      String(Date.now() + 30000)
    );
    expect(parse).not.toHaveBeenCalled();
    expect(mockGetResend).not.toHaveBeenCalled();
    expect(mockSend).not.toHaveBeenCalled();
  });

  test('preserves administrator-only auth invocation, rate key, recipient case, sender, rendering and success ID', async () => {
    const response = await invoke(
      request({ ...payload, from: 'ignored@example.invalid', ignored: true })
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ id: 'admin-welcome' });
    expect(mockAuth.mock.calls).toEqual([[]]);
    expect(mockRateLimit).toHaveBeenCalledWith(
      'administrator:send-welcome',
      RATE_LIMIT_CONFIGS.EMAIL
    );
    const input = mockSend.mock.calls[0][0];
    expect(input).toMatchObject({
      from: 'LodgeFlow <notifications@lodgeflow.app>',
      to: payload.email,
      subject: 'Welcome to LodgeFlow',
    });
    expect(renderToStaticMarkup(input.react)).toContain('Rae &amp; Finch');
    expect(mockSend).toHaveBeenCalledTimes(1);
  });

  test.each([undefined, null, ''])(
    'keeps the existing blank greeting for name %j',
    async firstName => {
      expect((await invoke(request({ ...payload, firstName }))).status).toBe(
        200
      );
      const text = renderToStaticMarkup(
        mockSend.mock.calls[0][0].react
      ).replace(/<[^>]+>/g, '');
      expect(text).toContain('join us, !');
      expect(text).not.toContain('Guest');
    }
  );

  test.each([undefined, null, '', 'invalid', ' spaced@example.invalid'])(
    'preserves invalid email denial (%j)',
    async email => {
      const response = await invoke(request({ ...payload, email }));
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: 'Invalid email address' });
      expect(mockRateLimit).toHaveBeenCalledTimes(1);
      expect(mockGetResend).not.toHaveBeenCalled();
      expect(mockSend).not.toHaveBeenCalled();
    }
  );

  test('keeps invalid email ahead of unusable template input', async () => {
    const response = await invoke(request({ email: 'invalid', firstName: {} }));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'Invalid email address' });
    expect(mockSend).not.toHaveBeenCalled();
  });

  test('keeps lazy notification overrides', async () => {
    expect((await invoke()).status).toBe(200);
    process.env.LODGEFLOW_NOTIFICATION_EMAIL_FROM = 'updates@example.invalid';
    expect((await invoke()).status).toBe(200);
    expect(mockSend.mock.calls.map(([input]) => input.from)).toEqual([
      'LodgeFlow <notifications@lodgeflow.app>',
      'LodgeFlow <updates@example.invalid>',
    ]);
  });

  test('preserves successful retry after provider rejection', async () => {
    mockSend.mockResolvedValueOnce({
      data: null,
      error: { name: 'application_error', message: 'Private provider detail' },
    });
    expect((await invoke()).status).toBe(500);
    const retry = await invoke();
    expect(retry.status).toBe(200);
    expect(await retry.json()).toEqual({ id: 'admin-welcome' });
    expect(mockSend).toHaveBeenCalledTimes(2);
  });
});

describe('admin welcome boundary regression', () => {
  test.each(['{', 'null', '[]', '"invalid"'])(
    'returns safe 400 JSON for body %s',
    async body => {
      const response = await invoke(
        new Request('https://admin.test', { method: 'POST', body })
      );
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({
        error: 'Invalid welcome email data',
      });
      expect(mockGetResend).not.toHaveBeenCalled();
      expect(mockSend).not.toHaveBeenCalled();
    }
  );

  test('rejects an array recipient instead of coercing it during validation', async () => {
    const response = await invoke(
      request({ ...payload, email: ['other@example.invalid'] })
    );
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'Invalid email address' });
    expect(mockSend).not.toHaveBeenCalled();
  });

  test.each([42, false, {}, ['Name']])(
    'rejects non-string name %j before provider setup',
    async firstName => {
      const response = await invoke(request({ ...payload, firstName }));
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({
        error: 'Invalid welcome email data',
      });
      expect(mockGetResend).not.toHaveBeenCalled();
      expect(mockSend).not.toHaveBeenCalled();
    }
  );

  async function expectSafeFailure() {
    const response = await invoke();
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: 'Failed to send welcome email',
    });
  }

  test('contains unexpected authorization-helper failures', async () => {
    mockAuth.mockRejectedValue(new Error('Private auth detail'));
    await expectSafeFailure();
    expect(mockRateLimit).not.toHaveBeenCalled();
    expect(mockSend).not.toHaveBeenCalled();
  });

  test('contains rate-limit setup failures without sending', async () => {
    mockRateLimit.mockRejectedValue(new Error('Private limiter detail'));
    await expectSafeFailure();
    expect(mockGetResend).not.toHaveBeenCalled();
    expect(mockSend).not.toHaveBeenCalled();
  });

  test('replaces exposed provider errors with a safe string', async () => {
    mockSend.mockResolvedValue({
      data: null,
      error: { name: 'application_error', message: 'Private provider detail' },
    });
    await expectSafeFailure();
    expect(mockSend).toHaveBeenCalledTimes(1);
  });

  test.each([new Error('Private send detail'), 'Private non-Error detail'])(
    'contains thrown send failure %j',
    async error => {
      mockSend.mockRejectedValue(error);
      await expectSafeFailure();
      expect(mockSend).toHaveBeenCalledTimes(1);
    }
  );

  test('contains lazy provider setup errors without sending', async () => {
    mockGetResend.mockImplementation(() => {
      throw new Error('Private setup detail');
    });
    await expectSafeFailure();
    expect(mockSend).not.toHaveBeenCalled();
  });

  test.each(['', 'bad\r\nBcc: other@example.invalid'])(
    'contains sender configuration failure %j without dispatch',
    async sender => {
      process.env.LODGEFLOW_NOTIFICATION_EMAIL_FROM = sender;
      await expectSafeFailure();
      expect(mockSend).not.toHaveBeenCalled();
    }
  );
});
