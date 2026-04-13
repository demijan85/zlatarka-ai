import type { MonthlySummaryRow } from '@/types/domain';

function round2(value: number): number {
  return Number(value.toFixed(2));
}

export type MonthlyReceiptAmounts = {
  milkAmount: number;
  stimulationPerLiter: number;
  stimulationAmount: number;
  baseAmount: number;
  taxAmount: number;
  totalAmount: number;
  pricePerLiterWithStimulation: number;
};

export function calculateMonthlyReceiptAmounts(row: MonthlySummaryRow): MonthlyReceiptAmounts {
  const milkAmount = round2(row.qty * row.pricePerQty);
  const stimulationPerLiter = round2(row.stimulation);
  const stimulationAmount = round2(row.qty * stimulationPerLiter);
  const taxAmount = round2(row.qty * (row.priceWithTax - row.pricePerQty));
  const totalAmount = round2(row.totalAmount);
  const baseAmount = round2(totalAmount - taxAmount);
  const pricePerLiterWithStimulation = round2(row.priceWithTax + row.stimulation);

  return {
    milkAmount,
    stimulationPerLiter,
    stimulationAmount,
    baseAmount,
    taxAmount,
    totalAmount,
    pricePerLiterWithStimulation,
  };
}
