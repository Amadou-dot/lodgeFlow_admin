/** Browser-safe money boundaries. Persistence and JSON remain numeric. */
declare const moneyUnit: unique symbol;
export type MajorCurrencyAmount = number & { readonly [moneyUnit]: 'major' };
export type Cents = number & { readonly [moneyUnit]: 'cents' };
export type MoneySign = 'nonnegative' | 'positive' | 'signed';

export class MoneyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MoneyError';
    Object.setPrototypeOf(this, MoneyError.prototype);
  }
}

function validateSign(value: number, sign: MoneySign): void {
  if (!Number.isFinite(value)) throw new MoneyError('Money must be finite');
  if (
    (sign === 'positive' && value <= 0) ||
    (sign === 'nonnegative' && value < 0)
  ) {
    throw new MoneyError(
      sign === 'positive'
        ? 'Money must be positive'
        : 'Money cannot be negative'
    );
  }
}

function exactCents(value: number): Cents {
  const decimal = String(value);
  if (!/^-?\d+(?:\.\d{1,2})?$/.test(decimal)) {
    throw new MoneyError('Money must have at most two decimal places');
  }
  const [whole, fraction = ''] = decimal.split('.');
  // Build the decimal integer before parsing it. Multiplying a binary float
  // can add a cent near the safe-integer limit even when the input is exact.
  return cents(Number(`${whole}${fraction.padEnd(2, '0')}`), {
    sign: 'signed',
  });
}

/**
 * `preserve` is for legacy prices/calculations that retain sub-cent precision.
 * `exact` is for amounts such as receipts: it validates, never rounds input.
 */
export function majorAmount(
  value: number,
  {
    precision,
    sign = 'nonnegative',
  }: { precision: 'exact' | 'preserve'; sign?: MoneySign }
): MajorCurrencyAmount {
  validateSign(value, sign);
  const scaled = value * 100;
  if (!Number.isFinite(scaled) || Math.abs(scaled) > Number.MAX_SAFE_INTEGER) {
    throw new MoneyError('Money exceeds the safe cents range');
  }
  if (precision === 'exact') exactCents(value);
  return value as MajorCurrencyAmount;
}

export function cents(
  value: number,
  { sign = 'nonnegative' }: { sign?: MoneySign } = {}
): Cents {
  validateSign(value, sign);
  if (!Number.isSafeInteger(value))
    throw new MoneyError('Cents must be a safe integer');
  return value as Cents;
}

/** Rounding is a business/provider policy, never an implicit unit conversion. */
export function majorToCents({
  amount,
  rounding,
}: {
  amount: MajorCurrencyAmount;
  rounding: 'exact' | 'nearest' | 'epsilon';
}): Cents {
  if (rounding === 'exact') return exactCents(amount);
  const adjustment = rounding === 'epsilon' ? Number.EPSILON : 0;
  return cents(Math.round((amount + adjustment) * 100), { sign: 'signed' });
}

export function centsToMajor(amount: Cents): MajorCurrencyAmount {
  const result = majorAmount(amount / 100, {
    precision: 'exact',
    sign: 'signed',
  });
  if (exactCents(result) !== amount)
    throw new MoneyError('Cents cannot be represented exactly in major units');
  return result;
}

export function roundMajorAmount(
  options: {
    amount: MajorCurrencyAmount;
  } & (
    | { rounding: 'nearest' | 'epsilon' }
    | { rounding: 'whole'; maximum?: MajorCurrencyAmount }
  )
): MajorCurrencyAmount {
  if (options.rounding === 'whole') {
    const rounded = Math.round(options.amount);
    return majorAmount(
      options.maximum === undefined
        ? rounded
        : Math.min(rounded, options.maximum),
      {
        // The maximum can itself be a legacy sub-cent price.
        precision: 'preserve',
        sign: 'signed',
      }
    );
  }
  // This is the existing major-unit business rounding rule, not a lossless
  // conversion of provider cents. Keep its multiply/round/divide semantics.
  return majorAmount(majorToCents(options) / 100, {
    precision: 'exact',
    sign: 'signed',
  });
}

interface CurrencyFormatOptions {
  currency?: string;
  locale?: string | string[];
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
  useGrouping?: boolean;
}

export function formatMajorAmount({
  amount,
  locale,
  currency = 'USD',
  ...options
}: CurrencyFormatOptions & {
  amount: MajorCurrencyAmount;
}): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    ...options,
  }).format(amount);
}

export function formatCents({
  amount,
  ...options
}: CurrencyFormatOptions & { amount: Cents }): string {
  return formatMajorAmount({ amount: centsToMajor(amount), ...options });
}

/** Retains existing fixed-point UI/email strings, including their grouping. */
export function majorToFixed({
  amount,
  fractionDigits = 2,
}: {
  amount: MajorCurrencyAmount;
  fractionDigits?: number;
}): string {
  return amount.toFixed(fractionDigits);
}
