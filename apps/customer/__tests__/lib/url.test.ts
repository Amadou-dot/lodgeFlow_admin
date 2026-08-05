import { normalizeBaseUrl } from '@/lib/url';

describe('normalizeBaseUrl', () => {
  describe('adds a missing scheme', () => {
    // NEXT_PUBLIC_APP_URL is stored in Vercel as a bare hostname. Without a
    // scheme, Stripe rejects success_url/cancel_url as non-absolute and
    // `new URL()` throws in metadataBase.
    it('defaults a bare hostname to https', () => {
      expect(normalizeBaseUrl('lodgeflow.app')).toBe('https://lodgeflow.app');
    });

    it('handles a bare subdomain', () => {
      expect(normalizeBaseUrl('lodgeflow.aseck.dev')).toBe(
        'https://lodgeflow.aseck.dev'
      );
    });

    it('uses http for bare localhost, which has no certificate', () => {
      expect(normalizeBaseUrl('localhost:3002')).toBe('http://localhost:3002');
      expect(normalizeBaseUrl('localhost')).toBe('http://localhost');
    });

    it('uses http for bare loopback addresses', () => {
      expect(normalizeBaseUrl('127.0.0.1:3000')).toBe('http://127.0.0.1:3000');
    });
  });

  describe('preserves an explicit scheme', () => {
    it('leaves https alone', () => {
      expect(normalizeBaseUrl('https://lodgeflow.app')).toBe(
        'https://lodgeflow.app'
      );
    });

    it('does not upgrade http to https', () => {
      expect(normalizeBaseUrl('http://localhost:3002')).toBe(
        'http://localhost:3002'
      );
    });
  });

  describe('strips trailing slashes', () => {
    // Callers join paths on, so a trailing slash yields a double slash.
    it('removes a single trailing slash', () => {
      expect(normalizeBaseUrl('https://lodgeflow.app/')).toBe(
        'https://lodgeflow.app'
      );
    });

    it('removes repeated trailing slashes', () => {
      expect(normalizeBaseUrl('lodgeflow.app///')).toBe(
        'https://lodgeflow.app'
      );
    });
  });

  describe('produces URLs the consumers can actually use', () => {
    it('yields an absolute URL Stripe accepts, from the production value', () => {
      const base = normalizeBaseUrl('lodgeflow.app');
      const successUrl = `${base}/payments/success?booking_id=abc123`;

      expect(() => new URL(successUrl)).not.toThrow();
      expect(successUrl).toBe(
        'https://lodgeflow.app/payments/success?booking_id=abc123'
      );
    });

    it('yields a metadataBase that new URL() accepts', () => {
      for (const raw of [
        'lodgeflow.app',
        'https://lodgeflow.app',
        'localhost:3002',
        'lodgeflow.app/',
      ]) {
        expect(() => new URL(normalizeBaseUrl(raw))).not.toThrow();
      }
    });
  });
});
