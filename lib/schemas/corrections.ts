import { z } from 'zod';

export const correctionRequestCreateSchema = z.object({
  yearMonth: z.string().regex(/^\d{4}-\d{2}$/),
  supplierId: z.coerce.number().int().positive(),
  entryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  fieldName: z.enum(['qty', 'fat_pct']),
  requestedValue: z.coerce.number().min(0),
  reason: z.string().trim().min(3).max(500),
}).superRefine((value, ctx) => {
  if (value.fieldName === 'fat_pct' && value.requestedValue > 20) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['requestedValue'],
      message: 'fat_pct correction value cannot be greater than 20',
    });
  }
});

export const correctionRequestReviewSchema = z.object({
  status: z.enum(['approved', 'rejected']),
  reviewNote: z.string().trim().max(500).optional(),
});
