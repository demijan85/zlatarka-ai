import type { CalculationConstants } from '../constants/calculation';

export const TAX_ON_STIMULATION_VALID_FROM = '2026-04-01';

export function average(values: number[]): number {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function usesTaxOnStimulation(effectiveDate: string): boolean {
  return effectiveDate >= TAX_ON_STIMULATION_VALID_FROM;
}

export function stimulationPerLiter(qty: number, constants: CalculationConstants): number {
  if (qty > constants.stimulationHighThreshold) return constants.stimulationHighAmount;
  if (qty > constants.stimulationLowThreshold) return constants.stimulationLowAmount;
  return 0;
}

export function pricePerLiterByFat(fatPct: number, constants: CalculationConstants): number {
  return fatPct * constants.pricePerFatPct;
}

export function priceWithTaxPerLiter(pricePerLiter: number, constants: CalculationConstants): number {
  return pricePerLiter * (1 + constants.taxPercentage / 100);
}

export function monthlyTotalAmount(
  qty: number,
  fatPct: number,
  constants: CalculationConstants,
  effectiveDate: string
): {
  pricePerQty: number;
  priceWithTax: number;
  stimulation: number;
  totalAmount: number;
} {
  const pricePerQty = pricePerLiterByFat(fatPct, constants);
  const priceWithTax = priceWithTaxPerLiter(pricePerQty, constants);
  const stimulation = stimulationPerLiter(qty, constants);
  const totalAmount = usesTaxOnStimulation(effectiveDate)
    ? qty * (priceWithTax + stimulation * (1 + constants.taxPercentage / 100))
    : qty * (priceWithTax + stimulation);

  return {
    pricePerQty,
    priceWithTax,
    stimulation,
    totalAmount,
  };
}

export function applyMonthlySummaryOverrides(
  qty: number,
  fatPct: number,
  base: {
    pricePerFatPct: number;
    pricePerQty: number;
    priceWithTax: number;
    stimulation: number;
  },
  taxPercentage: number,
  effectiveDate: string,
  overrides: {
    priceWithTaxOverride?: number | null;
    stimulationOverride?: number | null;
  }
): {
  pricePerFatPct: number;
  pricePerQty: number;
  priceWithTax: number;
  stimulation: number;
  totalAmount: number;
} {
  const priceWithTax = overrides.priceWithTaxOverride ?? base.priceWithTax;
  const pricePerQty = priceWithTax / (1 + taxPercentage / 100);
  const pricePerFatPct = fatPct > 0 ? pricePerQty / fatPct : base.pricePerFatPct;
  const stimulation = overrides.stimulationOverride ?? base.stimulation;
  const totalAmount = usesTaxOnStimulation(effectiveDate)
    ? qty * (priceWithTax + stimulation * (1 + taxPercentage / 100))
    : qty * (priceWithTax + stimulation);

  return {
    pricePerFatPct,
    pricePerQty,
    priceWithTax,
    stimulation,
    totalAmount,
  };
}

export function quarterlyTotalPremium(qty: number, premiumPerLiter: number): number {
  return qty * premiumPerLiter;
}
