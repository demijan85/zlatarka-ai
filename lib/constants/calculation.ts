import { z } from 'zod';
import { compareYearMonth } from '@/lib/utils/year-month';

export const calculationConstantsSchema = z.object({
  pricePerFatPct: z.number().nonnegative(),
  taxPercentage: z.number().min(0).max(100),
  stimulationLowThreshold: z.number().nonnegative(),
  stimulationHighThreshold: z.number().nonnegative(),
  stimulationLowAmount: z.number().nonnegative(),
  stimulationHighAmount: z.number().nonnegative(),
  premiumPerLiter: z.number().nonnegative(),
});

export type CalculationConstants = z.infer<typeof calculationConstantsSchema>;

export const validFromSchema = z.string().regex(/^\d{4}-\d{2}$/);

export const versionedCalculationConstantsSchema = calculationConstantsSchema.extend({
  validFrom: validFromSchema,
});

export type VersionedCalculationConstants = z.infer<typeof versionedCalculationConstantsSchema>;

export const defaultCalculationConstants: CalculationConstants = {
  pricePerFatPct: 12,
  taxPercentage: 8,
  stimulationLowThreshold: 500,
  stimulationHighThreshold: 1000,
  stimulationLowAmount: 1,
  stimulationHighAmount: 2,
  premiumPerLiter: 19,
};

export const defaultVersionedConstants: VersionedCalculationConstants = {
  validFrom: '2020-01',
  ...defaultCalculationConstants,
};

export function normalizeConstants(input: unknown): CalculationConstants {
  const parsed = calculationConstantsSchema.safeParse(input);
  if (!parsed.success) return defaultCalculationConstants;
  const values = parsed.data;

  if (values.stimulationHighThreshold < values.stimulationLowThreshold) {
    return {
      ...values,
      stimulationHighThreshold: values.stimulationLowThreshold,
    };
  }

  return values;
}

export function normalizeVersionedConstants(input: unknown): VersionedCalculationConstants {
  const parsed = versionedCalculationConstantsSchema.safeParse(input);
  if (!parsed.success) return defaultVersionedConstants;

  const normalized = normalizeConstants(parsed.data);
  return {
    validFrom: parsed.data.validFrom,
    ...normalized,
  };
}

export function sortVersions(
  versions: VersionedCalculationConstants[]
): VersionedCalculationConstants[] {
  return [...versions].sort((a, b) => compareYearMonth(a.validFrom, b.validFrom));
}

export function getEffectiveConstantsForPeriod(
  versions: VersionedCalculationConstants[],
  yearMonth: string
): VersionedCalculationConstants {
  const sorted = sortVersions(versions);
  let selected = sorted[0] ?? defaultVersionedConstants;

  for (const item of sorted) {
    if (compareYearMonth(item.validFrom, yearMonth) <= 0) {
      selected = item;
    }
  }

  return selected;
}

export function toCalculationConstants(version: VersionedCalculationConstants): CalculationConstants {
  return {
    pricePerFatPct: version.pricePerFatPct,
    taxPercentage: version.taxPercentage,
    stimulationLowThreshold: version.stimulationLowThreshold,
    stimulationHighThreshold: version.stimulationHighThreshold,
    stimulationLowAmount: version.stimulationLowAmount,
    stimulationHighAmount: version.stimulationHighAmount,
    premiumPerLiter: version.premiumPerLiter,
  };
}
