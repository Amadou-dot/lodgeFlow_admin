import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  cents,
  centsToMajor,
  formatCents,
  formatMajorAmount,
  majorAmount,
  majorToCents,
  majorToFixed,
  MoneyError,
  roundMajorAmount,
  type Cents,
  type MajorCurrencyAmount,
} from '../src/money';

type IsAssignable<A, B> = A extends B ? true : false;
const typeBoundaries: [
  IsAssignable<Cents, MajorCurrencyAmount>,
  IsAssignable<MajorCurrencyAmount, Cents>,
  IsAssignable<number, Cents>,
  IsAssignable<number, MajorCurrencyAmount>,
] = [false, false, false, false];

test('money units are distinct but serialize as existing numeric values', () => {
  assert.deepEqual(typeBoundaries, [false, false, false, false]);
  assert.equal(
    JSON.stringify({
      amount: majorAmount(12.34, { precision: 'exact' }),
      amountCents: cents(1234),
    }),
    '{"amount":12.34,"amountCents":1234}'
  );
});

test('exact cents accept ordinary decimal values and reject sub-cent inputs', () => {
  for (const amount of [0, 0.01, 0.07, 0.29, 1.01, 19.99, 123456.78]) {
    const major = majorAmount(amount, { precision: 'exact' });
    assert.equal(
      centsToMajor(majorToCents({ amount: major, rounding: 'exact' })),
      amount
    );
  }
  for (const amount of [0.001, 1.005, 10.999, 0.1 + 0.2]) {
    assert.throws(
      () => majorAmount(amount, { precision: 'exact' }),
      MoneyError
    );
  }
  assert.throws(
    () =>
      majorToCents({
        amount: majorAmount(1.005, { precision: 'preserve' }),
        rounding: 'exact',
      }),
    MoneyError
  );
});

test('constructors validate finiteness, safe bounds and explicit sign rules', () => {
  for (const value of [NaN, Infinity, -Infinity, Number.MAX_VALUE]) {
    assert.throws(
      () => majorAmount(value, { precision: 'preserve' }),
      MoneyError
    );
    assert.throws(() => cents(value), MoneyError);
  }
  for (const value of [0.1, Number.MAX_SAFE_INTEGER + 1, -1]) {
    assert.throws(() => cents(value), MoneyError);
  }
  assert.equal(cents(Number.MAX_SAFE_INTEGER), Number.MAX_SAFE_INTEGER);
  assert.throws(
    () =>
      majorAmount(Number.MAX_SAFE_INTEGER / 100 + 1, { precision: 'preserve' }),
    MoneyError
  );
  assert.throws(() => majorAmount(-1, { precision: 'exact' }), MoneyError);
  assert.throws(
    () => majorAmount(0, { precision: 'exact', sign: 'positive' }),
    MoneyError
  );
  assert.throws(() => cents(0, { sign: 'positive' }), MoneyError);
  assert.equal(majorAmount(-1, { precision: 'exact', sign: 'signed' }), -1);
  assert.equal(cents(-1, { sign: 'signed' }), -1);
});

test('legacy rounding policies stay distinct and price precision is preserved', () => {
  const amount = majorAmount(1.005, { precision: 'preserve' });
  assert.equal(amount, 1.005);
  assert.equal(majorToCents({ amount, rounding: 'nearest' }), 100);
  assert.equal(majorToCents({ amount, rounding: 'epsilon' }), 101);
  assert.equal(roundMajorAmount({ amount, rounding: 'nearest' }), 1);
  assert.equal(roundMajorAmount({ amount, rounding: 'epsilon' }), 1.01);
  assert.equal(
    roundMajorAmount({
      amount: majorAmount(25.5, { precision: 'preserve' }),
      rounding: 'whole',
    }),
    26
  );
});

test('exact conversions keep cents near the numeric limit and reject lossy major conversions', () => {
  const amount = majorAmount(90071992547409.9, { precision: 'exact' });
  assert.equal(majorToCents({ amount, rounding: 'exact' }), 9007199254740990);
  assert.equal(centsToMajor(cents(9007199254740990)), amount);
  // Both integers are safe cents, but the second cannot be represented as a
  // numeric major-unit value without losing a cent. Never silently convert it.
  assert.throws(() => centsToMajor(cents(Number.MAX_SAFE_INTEGER)), MoneyError);
});

test('formatting requires a unit and preserves locale, precision and fixed output', () => {
  const amount = majorAmount(1234.5, { precision: 'exact' });
  assert.equal(
    formatMajorAmount({ amount, locale: 'en-US', currency: 'USD' }),
    '$1,234.50'
  );
  assert.equal(
    formatCents({ amount: cents(123450), locale: 'en-US', currency: 'USD' }),
    '$1,234.50'
  );
  assert.equal(
    formatMajorAmount({
      amount,
      locale: 'en-US',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }),
    '$1,235'
  );
  assert.equal(majorToFixed({ amount }), '1234.50');
});
