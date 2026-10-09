import {
  formatMajorAmount,
  majorAmount,
  majorToFixed,
} from '@lodgeflow/database/money';

/** Existing email currency presentation uses USD, grouping and Intl rounding. */
export function formatUsdAmount(amount: number): string {
  return formatMajorAmount({
    amount: majorAmount(amount, { precision: 'preserve', sign: 'signed' }),
    locale: 'en-US',
    currency: 'USD',
  });
}

/** Existing calculator/cancellation text uses two decimals without grouping. */
export function formatFixedMajorAmount(amount: number): string {
  return majorToFixed({
    amount: majorAmount(amount, { precision: 'preserve', sign: 'signed' }),
  });
}
