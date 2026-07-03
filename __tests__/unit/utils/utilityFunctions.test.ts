import { LOYALTY_TIERS } from '@/lib/config';
import {
  calcNumNights,
  formatCurrency,
  getInitials,
  getLoyaltyTier,
  isImageUrl,
  validateEmail,
} from '@/utils/utilityFunctions';

describe('utilityFunctions', () => {
  describe('getLoyaltyTier', () => {
    it('returns Bronze below the Silver threshold', () => {
      expect(getLoyaltyTier(0)).toEqual({ tier: 'Bronze', color: 'primary' });
      expect(getLoyaltyTier(LOYALTY_TIERS.SILVER.threshold - 1).tier).toBe(
        'Bronze'
      );
    });

    it('returns each tier exactly at its threshold', () => {
      expect(getLoyaltyTier(LOYALTY_TIERS.SILVER.threshold).tier).toBe(
        'Silver'
      );
      expect(getLoyaltyTier(LOYALTY_TIERS.GOLD.threshold).tier).toBe('Gold');
      expect(getLoyaltyTier(LOYALTY_TIERS.DIAMOND.threshold).tier).toBe(
        'Diamond'
      );
    });

    it('returns Diamond for very large totals', () => {
      expect(getLoyaltyTier(1_000_000)).toEqual({
        tier: 'Diamond',
        color: 'secondary',
      });
    });
  });

  describe('getInitials', () => {
    it('returns uppercase initials for first and last name', () => {
      expect(getInitials('john doe')).toBe('JD');
    });

    it('caps initials at two characters', () => {
      expect(getInitials('Anna Maria van der Berg')).toBe('AM');
    });

    it('returns single initial for single names', () => {
      expect(getInitials('Cher')).toBe('C');
    });
  });

  describe('calcNumNights', () => {
    it('calculates nights between two dates', () => {
      expect(calcNumNights('2026-07-01', '2026-07-05')).toBe(4);
    });

    it('returns 0 when either date is missing', () => {
      expect(calcNumNights('', '2026-07-05')).toBe(0);
      expect(calcNumNights('2026-07-01', '')).toBe(0);
    });

    it('returns negative nights when the range is inverted', () => {
      expect(calcNumNights('2026-07-05', '2026-07-01')).toBe(-4);
    });
  });

  describe('formatCurrency', () => {
    it('formats USD by default', () => {
      expect(formatCurrency(1234.5)).toBe('$1,234.50');
    });

    it('formats other currencies', () => {
      expect(formatCurrency(1000, 'EUR')).toBe('€1,000.00');
    });

    it('falls back to the default currency when given an empty string', () => {
      expect(formatCurrency(10, '')).toBe('$10.00');
    });

    it('formats negative amounts', () => {
      expect(formatCurrency(-50)).toBe('-$50.00');
    });
  });

  describe('validateEmail', () => {
    it.each(['user@example.com', 'first.last@sub.domain.org', 'a@b.co'])(
      'accepts %s',
      email => {
        expect(validateEmail(email)).toBe(true);
      }
    );

    it.each(['plainaddress', 'missing@tld', '@nouser.com', 'two words@x.com'])(
      'rejects %s',
      email => {
        expect(validateEmail(email)).toBe(false);
      }
    );
  });

  describe('isImageUrl', () => {
    const originalFetch = global.fetch;

    afterEach(() => {
      global.fetch = originalFetch;
    });

    it('returns false for non-string input', async () => {
      await expect(isImageUrl(undefined)).resolves.toBe(false);
    });

    it('returns false for invalid URLs without fetching', async () => {
      global.fetch = jest.fn();
      await expect(isImageUrl('not a url')).resolves.toBe(false);
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('returns true when HEAD request reports an image content-type', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        headers: { get: () => 'image/png' },
      });
      await expect(isImageUrl('https://example.com/pic.png')).resolves.toBe(
        true
      );
    });

    it('returns false for non-image content-type', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        headers: { get: () => 'text/html' },
      });
      await expect(isImageUrl('https://example.com/page')).resolves.toBe(false);
    });

    it('returns false when the request fails', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('network down'));
      await expect(isImageUrl('https://example.com/pic.png')).resolves.toBe(
        false
      );
    });
  });
});
