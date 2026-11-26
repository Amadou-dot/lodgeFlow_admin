import { z } from 'zod';
import { recentCustomerBookingJsonSchema } from './booking-json';
import { customerJsonSchema } from './customer-json';

const successFields = {
  success: z.literal(true),
  message: z.string().optional(),
  error: z.never().optional(),
};

export const customerDetailSuccessResponseSchema = z.object({
  ...successFields,
  data: customerJsonSchema.extend({
    completedBookings: z.number(),
    totalRevenue: z.number(),
    averageStayLength: z.number(),
    recentBookings: z.array(recentCustomerBookingJsonSchema),
  }),
});

export const customerMutationSuccessResponseSchema = z.object({
  ...successFields,
  data: customerJsonSchema,
});

export const customerDeleteSuccessResponseSchema = z.object({
  ...successFields,
  data: z.never().optional(),
});

export const customerMutationErrorSchema = z.object({
  error: z.string().min(1),
});

// Retain the validated original JSON so additive fields survive in the hooks.
export function isCustomerDetailSuccessResponse(
  value: unknown
): value is z.output<typeof customerDetailSuccessResponseSchema> {
  return customerDetailSuccessResponseSchema.safeParse(value).success;
}

export function isCustomerMutationSuccessResponse(
  value: unknown
): value is z.output<typeof customerMutationSuccessResponseSchema> {
  return customerMutationSuccessResponseSchema.safeParse(value).success;
}
