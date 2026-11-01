import type { z } from 'zod';
import type { customerJsonSchema } from '@/lib/validations/customer-json';

export type CustomerJson = z.output<typeof customerJsonSchema>;

export type GuestFormCustomer = Pick<
  CustomerJson,
  | 'id'
  | 'first_name'
  | 'last_name'
  | 'email'
  | 'phone'
  | 'nationality'
  | 'nationalId'
  | 'address'
  | 'emergencyContact'
  | 'preferences'
>;
