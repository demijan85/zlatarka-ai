import { z } from 'zod';

function isValidCalendarDate(year: number, month: number, day: number): boolean {
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export function normalizeCalculationValidFrom(value: string): string {
  if (/^\d{4}-\d{2}$/.test(value)) {
    const year = Number(value.slice(0, 4));
    const month = Number(value.slice(5, 7));
    if (month < 1 || month > 12) {
      throw new Error('Invalid validFrom month. Expected 01-12');
    }
    return `${value}-01`;
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error('Invalid validFrom format. Expected YYYY-MM-DD');
  }

  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));
  const day = Number(value.slice(8, 10));
  if (!isValidCalendarDate(year, month, day)) {
    throw new Error('Invalid validFrom date');
  }
  if (day !== 1 && day !== 16) {
    throw new Error('Calculation constants can start only on the 1st or 16th day of the month');
  }

  return value;
}

export function normalizeCalculationEffectiveDate(value: string): string {
  if (/^\d{4}-\d{2}$/.test(value)) {
    return `${value}-01`;
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error('Invalid effective date format. Expected YYYY-MM or YYYY-MM-DD');
  }

  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));
  const day = Number(value.slice(8, 10));
  if (!isValidCalendarDate(year, month, day)) {
    throw new Error('Invalid effective date');
  }

  return value;
}

function compareEffectiveDate(a: string, b: string): number {
  return normalizeCalculationEffectiveDate(a).localeCompare(normalizeCalculationEffectiveDate(b));
}

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

export const validFromSchema = z
  .string()
  .refine((value) => {
    try {
      normalizeCalculationValidFrom(value);
      return true;
    } catch {
      return false;
    }
  }, 'Invalid validFrom date')
  .transform((value) => normalizeCalculationValidFrom(value));

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
  validFrom: '2020-01-01',
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
  return [...versions].sort((a, b) => compareEffectiveDate(a.validFrom, b.validFrom));
}

export function getEffectiveConstantsForPeriod(
  versions: VersionedCalculationConstants[],
  effectiveDate: string
): VersionedCalculationConstants {
  const sorted = sortVersions(versions);
  let selected = sorted[0] ?? defaultVersionedConstants;
  const normalizedDate = normalizeCalculationEffectiveDate(effectiveDate);

  for (const item of sorted) {
    if (compareEffectiveDate(item.validFrom, normalizedDate) <= 0) {
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
