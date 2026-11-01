import { z } from 'zod';
import { customerJsonSchema } from './customer-json';

export const customersSuccessResponseSchema = z.object({
  success: z.literal(true),
  data: z.array(customerJsonSchema),
  message: z.string().optional(),
  pagination: z.object({
    currentPage: z.number(),
    totalPages: z.number(),
    totalCustomers: z.number(),
    limit: z.number(),
    hasNextPage: z.boolean(),
    hasPrevPage: z.boolean(),
  }),
});

export function isCustomersSuccessResponse(
  value: unknown
): value is z.output<typeof customersSuccessResponseSchema> {
  // Validate known fields, but retain the original object and additive fields
  // instead of replacing it with Zod's stripped projection.
  return customersSuccessResponseSchema.safeParse(value).success;
}
