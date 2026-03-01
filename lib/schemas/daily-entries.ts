import { z } from 'zod';

export const dailyEntrySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  qty: z.coerce.number().nonnegative(),
  fat_pct: z.coerce.number().min(0).max(20).nullable().optional(),
  supplierId: z.coerce.number().int().positive(),
});

export const dailyEntryUpsertSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  qty: z.coerce.number().nonnegative().optional(),
  fat_pct: z.coerce.number().min(0).max(20).nullable().optional(),
  supplierId: z.coerce.number().int().positive(),
});

export const bulkUpsertSchema = z.array(dailyEntryUpsertSchema);

export const dailyIntakeLockSchema = z.object({
  yearMonth: z.string().regex(/^\d{4}-\d{2}$/),
  isLocked: z.boolean(),
});
