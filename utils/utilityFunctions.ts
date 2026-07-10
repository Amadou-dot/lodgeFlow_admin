import { CURRENCY, LOYALTY_TIERS } from '@/lib/config';

type LoyaltyColor = 'secondary' | 'warning' | 'default' | 'primary';

export const getLoyaltyTier = (
  totalSpent: number
): { tier: string; color: LoyaltyColor } => {
  if (totalSpent >= LOYALTY_TIERS.DIAMOND.threshold)
    return {
      tier: LOYALTY_TIERS.DIAMOND.name,
      color: LOYALTY_TIERS.DIAMOND.color as LoyaltyColor,
    };
  if (totalSpent >= LOYALTY_TIERS.GOLD.threshold)
    return {
      tier: LOYALTY_TIERS.GOLD.name,
      color: LOYALTY_TIERS.GOLD.color as LoyaltyColor,
    };
  if (totalSpent >= LOYALTY_TIERS.SILVER.threshold)
    return {
      tier: LOYALTY_TIERS.SILVER.name,
      color: LOYALTY_TIERS.SILVER.color as LoyaltyColor,
    };
  return {
    tier: LOYALTY_TIERS.BRONZE.name,
    color: LOYALTY_TIERS.BRONZE.color as LoyaltyColor,
  };
};

export const getInitials = (name: string) => {
  return name
    .split(' ')
    .map(word => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
};

export const calcNumNights = (checkInDate: string, checkOutDate: string) => {
  return checkInDate && checkOutDate
    ? Math.ceil(
        (new Date(checkOutDate).getTime() - new Date(checkInDate).getTime()) /
          (1000 * 60 * 60 * 24)
      )
    : 0;
};

export const formatCurrency = (
  amount: number,
  currency: string = CURRENCY.DEFAULT
): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency || CURRENCY.DEFAULT,
  }).format(amount);
};

export async function isImageUrl(url: string | undefined): Promise<boolean> {
  if (typeof url !== 'string') return false;

  try {
    // Quick sanity check: must be a valid URL
    new URL(url);

    // Try a HEAD request to check Content-Type with timeout
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000); // 5 seconds timeout
    try {
      const res = await fetch(url, {
        method: 'HEAD',
        signal: controller.signal,
      });
      const contentType = res.headers.get('content-type') || '';
      return contentType.startsWith('image/');
    } catch (err) {
      // If fetch was aborted or failed, treat as not an image
      return false;
    } finally {
      clearTimeout(timeout);
    }
  } catch {
    return false;
  }
}

export const validateEmail = (email: string) => {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(String(email).toLowerCase());
};
