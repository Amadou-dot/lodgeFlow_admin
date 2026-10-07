import { z } from 'zod';

// These legacy read filters accept arbitrary scalar equality values (including
// unmatched categories/statuses). Writes use the stricter resource schemas.
const text = z.string().nullable();
const ascendingOrder = text.transform(value =>
  value === 'desc' ? (-1 as const) : (1 as const)
);

export const cabinQuerySchema = z.object({
  filter: z
    .enum(['with-discount', 'no-discount', 'small', 'medium', 'large'])
    .optional()
    .catch(undefined),
  search: text,
  capacity: z.enum(['small', 'medium', 'large']).optional().catch(undefined),
  discount: z.enum(['with', 'without']).optional().catch(undefined),
  status: text,
  sortBy: z
    .enum(['name', 'price', 'capacity', 'discount', 'status', 'createdAt'])
    .catch('name'),
  sortOrder: ascendingOrder,
});

export const diningQuerySchema = z.object({
  type: text,
  mealType: text,
  category: text,
  isAvailable: text.transform(value =>
    value === null ? undefined : value === 'true'
  ),
  search: text,
  sortBy: z
    .enum([
      'name',
      'price',
      'type',
      'mealType',
      'category',
      'maxPeople',
      'createdAt',
    ])
    .catch('name'),
  sortOrder: ascendingOrder,
});

export const experienceQuerySchema = z.object({
  search: text,
  category: text,
  difficulty: text,
  sortBy: z
    .enum([
      'name',
      'price',
      'duration',
      'difficulty',
      'category',
      'isPopular',
      'createdAt',
    ])
    .optional()
    .catch(undefined),
  sortOrder: ascendingOrder,
});

export const bookingQuerySchema = z.object({
  status: text,
  search: text,
  sortBy: text
    .transform(value => (value === 'created_at' ? 'createdAt' : value))
    .pipe(
      z
        .enum([
          'checkInDate',
          'checkOutDate',
          'totalPrice',
          'createdAt',
          'status',
          'numNights',
          'numGuests',
        ])
        .catch('checkInDate')
    ),
  sortOrder: text.transform(value =>
    !value || value === 'desc' ? (-1 as const) : (1 as const)
  ),
});
