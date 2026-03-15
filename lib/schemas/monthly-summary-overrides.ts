import { z } from 'zod';

export const monthlySummaryOverrideSchema = z.object({
  yearMonth: z.string().regex(/^\d{4}-\d{2}$/),
  period: z.enum(['all', 'first', 'second']),
  supplierId: z.coerce.number().int().positive(),
  priceWithTaxOverride: z.coerce.number().nonnegative().nullable(),
  stimulationOverride: z.coerce.number().nonnegative().nullable(),
});
