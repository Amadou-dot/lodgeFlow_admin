import { renderHook } from '@testing-library/react';
import {
  useSendConfirmationEmail,
  useSendWelcomeEmail,
} from '@/hooks/useSendEmail';

beforeEach(() => {
  jest.clearAllMocks();
  (global.fetch as jest.Mock) = jest.fn();
});

describe('useSendConfirmationEmail', () => {
  it('returns sendConfirmationEmail function', () => {
    const { result } = renderHook(() => useSendConfirmationEmail());

    expect(result.current.sendConfirmationEmail).toBeInstanceOf(Function);
  });

  it('sends POST to /api/send/confirm with correct data', async () => {
    const mockBookingData = { _id: 'booking1' } as any;
    const mockCabinData = { _id: 'cabin1', name: 'Lake Cabin' } as any;

    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true }),
    });

    const { result } = renderHook(() => useSendConfirmationEmail());
    await result.current.sendConfirmationEmail(
      'John',
      'john@example.com',
      mockBookingData,
      mockCabinData
    );

    expect(global.fetch).toHaveBeenCalledWith('/api/send/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        firstName: 'John',
        email: 'john@example.com',
        bookingData: mockBookingData,
        cabinData: mockCabinData,
      }),
    });
  });

  it('throws on non-ok response', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: 'Email service unavailable' }),
    });

    const { result } = renderHook(() => useSendConfirmationEmail());

    await expect(
      result.current.sendConfirmationEmail(
        'John',
        'john@example.com',
        {} as any,
        {} as any
      )
    ).rejects.toThrow('Email service unavailable');
  });

  it('uses default error message when none provided', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({}),
    });

    const { result } = renderHook(() => useSendConfirmationEmail());

    await expect(
      result.current.sendConfirmationEmail(
        'John',
        'john@example.com',
        {} as any,
        {} as any
      )
    ).rejects.toThrow('Failed to send confirmation email');
  });
});

describe('useSendWelcomeEmail', () => {
  it('returns sendWelcomeEmail function', () => {
    const { result } = renderHook(() => useSendWelcomeEmail());

    expect(result.current.sendWelcomeEmail).toBeInstanceOf(Function);
  });

  it('sends POST to /api/send/welcome with correct data', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true }),
    });

    const { result } = renderHook(() => useSendWelcomeEmail());
    await result.current.sendWelcomeEmail('Jane', 'jane@example.com');

    expect(global.fetch).toHaveBeenCalledWith('/api/send/welcome', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        firstName: 'Jane',
        email: 'jane@example.com',
      }),
    });
  });

  it('throws on non-ok response', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
    });

    const { result } = renderHook(() => useSendWelcomeEmail());

    await expect(
      result.current.sendWelcomeEmail('Jane', 'jane@example.com')
    ).rejects.toThrow('Failed to send welcome email');
  });
});
