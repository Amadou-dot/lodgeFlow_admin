import { z } from 'zod';
import { majorAmount, MoneyError } from '@lodgeflow/database/money';

function majorAmountSchema(precision: 'exact' | 'preserve') {
  return z.number().transform((value, context) => {
    try {
      return majorAmount(value, { precision });
    } catch (error) {
      if (!(error instanceof MoneyError)) throw error;
      context.addIssue({ code: 'custom', message: error.message });
      return z.NEVER;
    }
  });
}

/** Catalog/settings values keep their existing precision until business rounding. */
export const priceAmountSchema = majorAmountSchema('preserve');
/** Receipt/refund requests are exact amounts, not a rounding instruction. */
export const receiptAmountSchema = majorAmountSchema('exact');
