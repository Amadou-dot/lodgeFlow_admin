import { updateCabinSchema } from '@/lib/validations/cabin';
import { updateDiningSchema } from '@/lib/validations/dining';
import { updateExperienceSchema } from '@/lib/validations/experience';
import { updateSettingsSchema } from '@/lib/validations/settings';
import { bulkCabinSchema } from '@/lib/validations/bulk-cabin';
import { patchBookingSchema } from '@/lib/validations/booking';

const id = '507f1f77bcf86cd799439011';

describe('monetary request boundaries', () => {
  it.each([NaN, Infinity, -1, Number.MAX_SAFE_INTEGER])(
    'rejects invalid catalog/settings money %s at the relevant field',
    price => {
      for (const result of [
        updateCabinSchema.safeParse({ _id: id, price }),
        updateDiningSchema.safeParse({ _id: id, price }),
        updateExperienceSchema.safeParse({ _id: id, price }),
        updateSettingsSchema.safeParse({ breakfastPrice: price }),
        bulkCabinSchema.safeParse({
          action: 'update-discount',
          ids: [id],
          discount: price,
        }),
      ]) {
        expect(result.success).toBe(false);
        if (!result.success)
          expect(result.error.issues[0].path.length).toBeGreaterThan(0);
      }
    }
  );

  it('retains accepted sub-cent catalog prices and sparse PATCH fields', () => {
    expect(updateCabinSchema.parse({ _id: id, price: 1.005 })).toEqual({
      _id: id,
      price: 1.005,
    });
    expect(updateDiningSchema.parse({ _id: id, price: 0.333 })).toEqual({
      _id: id,
      price: 0.333,
    });
    expect(updateExperienceSchema.parse({ _id: id, price: 0 })).toEqual({
      _id: id,
      price: 0,
    });
    expect(updateSettingsSchema.parse({ breakfastPrice: 0.105 })).toEqual({
      breakfastPrice: 0.105,
    });
  });

  it.each([0.001, 1.005, Number.MAX_SAFE_INTEGER])(
    'rejects invalid new receipt/refund amount %s',
    amount => {
      expect(
        patchBookingSchema.safeParse({
          recordPayment: { paymentMethod: 'cash', amountPaid: amount },
        }).success
      ).toBe(false);
      expect(
        patchBookingSchema.safeParse({
          refundStatus: 'partial',
          refundAmount: amount,
        }).success
      ).toBe(false);
    }
  );

  it('accepts exact decimal receipts and explicit zero refund metadata', () => {
    expect(
      patchBookingSchema.parse({
        recordPayment: { paymentMethod: 'cash', amountPaid: 0.29 },
      }).recordPayment?.amountPaid
    ).toBe(0.29);
    expect(
      patchBookingSchema.parse({ refundStatus: 'none', refundAmount: 0 })
        .refundAmount
    ).toBe(0);
  });
});
