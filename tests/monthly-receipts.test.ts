import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateMonthlyReceiptAmounts } from '../lib/exports/monthly-receipts.ts';
import type { MonthlySummaryRow } from '../types/domain.ts';

const baseRow: MonthlySummaryRow = {
  serialNum: 1,
  supplierId: 1,
  firstName: 'Test',
  lastName: 'Supplier',
  city: null,
  street: null,
  zipCode: null,
  jmbg: null,
  bankAccount: null,
  qty: 1000,
  fatPct: 3.5,
  calculatedPricePerFatPct: 12,
  pricePerFatPct: 12,
  calculatedPricePerQty: 42,
  pricePerQty: 42,
  taxPercentage: 8,
  calculatedPriceWithTax: 45.36,
  priceWithTax: 45.36,
  calculatedStimulation: 1,
  stimulation: 1,
  totalAmount: 46360,
  priceWithTaxOverride: null,
  stimulationOverride: null,
};

test('monthly receipt amounts match monthly summary formula', () => {
  const result = calculateMonthlyReceiptAmounts(baseRow);

  assert.equal(result.milkAmount, 42000);
  assert.equal(result.stimulationPerLiter, 1);
  assert.equal(result.stimulationAmount, 1000);
  assert.equal(result.taxAmount, 3360);
  assert.equal(result.baseAmount, 43000);
  assert.equal(result.totalAmount, 46360);
  assert.equal(result.pricePerLiterWithStimulation, 46.36);
});

test('monthly receipt tax excludes stimulation overrides', () => {
  const result = calculateMonthlyReceiptAmounts({
    ...baseRow,
    priceWithTax: 54,
    stimulation: 3,
    totalAmount: 57000,
  });

  assert.equal(result.milkAmount, 42000);
  assert.equal(result.stimulationAmount, 3000);
  assert.equal(result.taxAmount, 12000);
  assert.equal(result.baseAmount, 45000);
  assert.equal(result.totalAmount, 57000);
  assert.equal(result.pricePerLiterWithStimulation, 57);
});
