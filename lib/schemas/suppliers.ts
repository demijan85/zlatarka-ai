import { z } from 'zod';

export const supplierSchema = z.object({
  order_index: z.coerce.number().int().nonnegative(),
  first_name: z.string().min(1),
  last_name: z.string().min(1),
  phone: z.string().optional().nullable(),
  email: z.string().email().optional().nullable().or(z.literal('')),
  jmbg: z.string().optional().nullable(),
  agriculture_number: z.string().optional().nullable(),
  bank_account: z.string().optional().nullable(),
  street: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  country: z.string().optional().nullable(),
  zip_code: z.string().optional().nullable(),
  number_of_cows: z.coerce.number().int().nonnegative().optional().nullable(),
});

export const supplierUpdateSchema = supplierSchema.partial();
