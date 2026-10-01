/** @jest-environment node */
import { renderToStaticMarkup } from 'react-dom/server';
import type { ReactElement } from 'react';

interface WelcomeIdentity {
  firstName: string | null;
  primaryEmailAddressId: string;
  emailAddresses: { id: string; emailAddress: string }[];
}
interface EmailInput {
  from: string;
  to: string;
  subject: string;
  react: ReactElement;
}
type SendResult =
  | { data: { id: string }; error: null }
  | { data: null; error: { name: string; message: string } };
const mockAuth = jest.fn<Promise<{ userId: string | null }>, []>();
const mockCurrentUser = jest.fn<Promise<WelcomeIdentity | null>, []>();
const mockSend = jest.fn<Promise<SendResult>, [EmailInput]>();
const mockGetResend = jest.fn(() => ({ emails: { send: mockSend } }));
jest.mock('@clerk/nextjs/server', () => ({
  auth: () => mockAuth(),
  currentUser: () => mockCurrentUser(),
}));
jest.mock('@/lib/resend', () => ({ getResend: () => mockGetResend() }));
import { POST } from '@/app/api/send/welcome/route';

const originalSender = process.env.LODGEFLOW_NOTIFICATION_EMAIL_FROM;
function identity(): WelcomeIdentity {
  return {
    firstName: 'Rae & Finch',
    primaryEmailAddressId: 'second',
    emailAddresses: [
      { id: 'first', emailAddress: 'first@example.invalid' },
      { id: 'second', emailAddress: 'primary@example.invalid' },
    ],
  };
}
beforeEach(() => {
  jest.resetAllMocks();
  delete process.env.LODGEFLOW_NOTIFICATION_EMAIL_FROM;
  mockAuth.mockResolvedValue({ userId: 'owner' });
  mockCurrentUser.mockResolvedValue(identity());
  mockGetResend.mockReturnValue({ emails: { send: mockSend } });
  mockSend.mockResolvedValue({ data: { id: 'welcome-message' }, error: null });
});
afterEach(() => {
  if (originalSender === undefined)
    delete process.env.LODGEFLOW_NOTIFICATION_EMAIL_FROM;
  else process.env.LODGEFLOW_NOTIFICATION_EMAIL_FROM = originalSender;
});

describe('welcome email characterization', () => {
  test('denies missing authentication before profile lookup or provider setup', async () => {
    mockAuth.mockResolvedValue({ userId: null });
    const response = await POST();
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: 'Authentication required' });
    expect(mockCurrentUser).not.toHaveBeenCalled();
    expect(mockGetResend).not.toHaveBeenCalled();
    expect(mockSend).not.toHaveBeenCalled();
  });

  test('preserves the first email recipient, notification sender, subject, rendered name and message ID', async () => {
    const response = await POST();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ id: 'welcome-message' });
    const input = mockSend.mock.calls[0][0];
    expect(input).toMatchObject({
      from: 'LodgeFlow <notifications@lodgeflow.app>',
      to: 'first@example.invalid',
      subject: 'Welcome to LodgeFlow',
    });
    const html = renderToStaticMarkup(input.react);
    expect(html).toContain('Rae &amp; Finch');
    expect(html).toContain('Welcome to LodgeFlow!');
    expect(mockSend).toHaveBeenCalledTimes(1);
  });

  test.each([null, ''])(
    'keeps the Guest fallback for name %j',
    async firstName => {
      mockCurrentUser.mockResolvedValue({ ...identity(), firstName });
      expect((await POST()).status).toBe(200);
      expect(renderToStaticMarkup(mockSend.mock.calls[0][0].react)).toContain(
        'Guest'
      );
    }
  );

  test.each<WelcomeIdentity | null>([
    null,
    { ...identity(), emailAddresses: [] },
    {
      ...identity(),
      emailAddresses: [
        { id: 'first', emailAddress: 'invalid' },
        { id: 'second', emailAddress: 'valid@example.invalid' },
      ],
    },
    {
      ...identity(),
      emailAddresses: [
        { id: 'first', emailAddress: ' spaced@example.invalid' },
      ],
    },
  ])(
    'rejects missing/invalid first email without initializing the provider (%j)',
    async user => {
      mockCurrentUser.mockResolvedValue(user);
      const response = await POST();
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: 'Invalid email address' });
      expect(mockGetResend).not.toHaveBeenCalled();
      expect(mockSend).not.toHaveBeenCalled();
    }
  );

  test('resolves the existing sender override lazily for each request', async () => {
    expect((await POST()).status).toBe(200);
    process.env.LODGEFLOW_NOTIFICATION_EMAIL_FROM = 'updates@example.invalid';
    expect((await POST()).status).toBe(200);
    expect(mockSend.mock.calls.map(([input]) => input.from)).toEqual([
      'LodgeFlow <notifications@lodgeflow.app>',
      'LodgeFlow <updates@example.invalid>',
    ]);
  });

  test('retains successful retry after provider rejection', async () => {
    mockSend.mockResolvedValueOnce({
      data: null,
      error: { name: 'application_error', message: 'Private provider detail' },
    });
    expect((await POST()).status).toBe(500);
    const retry = await POST();
    expect(retry.status).toBe(200);
    expect(await retry.json()).toEqual({ id: 'welcome-message' });
    expect(mockSend).toHaveBeenCalledTimes(2);
  });
});

describe('welcome email safe failure regression', () => {
  async function expectSafeFailure() {
    const response = await POST();
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: 'Failed to send welcome email',
    });
  }

  test('contains auth SDK failures before any profile or provider call', async () => {
    mockAuth.mockRejectedValue(new Error('Private authentication detail'));
    await expectSafeFailure();
    expect(mockCurrentUser).not.toHaveBeenCalled();
    expect(mockGetResend).not.toHaveBeenCalled();
    expect(mockSend).not.toHaveBeenCalled();
  });

  test('contains profile SDK failures before provider setup', async () => {
    mockCurrentUser.mockRejectedValue(new Error('Private profile detail'));
    await expectSafeFailure();
    expect(mockGetResend).not.toHaveBeenCalled();
    expect(mockSend).not.toHaveBeenCalled();
  });

  test('returns a safe string for provider rejection instead of its error object', async () => {
    mockSend.mockResolvedValue({
      data: null,
      error: { name: 'application_error', message: 'Private provider detail' },
    });
    await expectSafeFailure();
    expect(mockSend).toHaveBeenCalledTimes(1);
  });

  test.each([new Error('Private send detail'), 'Private non-Error detail'])(
    'contains a thrown provider failure (%j)',
    async error => {
      mockSend.mockRejectedValue(error);
      await expectSafeFailure();
      expect(mockSend).toHaveBeenCalledTimes(1);
    }
  );

  test('contains lazy provider setup failures without dispatching', async () => {
    mockGetResend.mockImplementation(() => {
      throw new Error('Private setup detail');
    });
    await expectSafeFailure();
    expect(mockSend).not.toHaveBeenCalled();
  });

  test.each(['', 'bad\r\nBcc: other@example.invalid'])(
    'contains invalid sender configuration without dispatching (%j)',
    async sender => {
      process.env.LODGEFLOW_NOTIFICATION_EMAIL_FROM = sender;
      await expectSafeFailure();
      expect(mockSend).not.toHaveBeenCalled();
    }
  );
});
