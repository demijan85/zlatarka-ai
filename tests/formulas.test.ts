import test from 'node:test';
import assert from 'node:assert/strict';
import {
  average,
  monthlyTotalAmount,
  pricePerLiterByFat,
  priceWithTaxPerLiter,
  quarterlyTotalPremium,
  stimulationPerLiter,
} from '../lib/calculations/formulas.ts';

const testConstants = {
  pricePerFatPct: 12,
  taxPercentage: 8,
  stimulationLowThreshold: 500,
  stimulationHighThreshold: 1000,
  stimulationLowAmount: 1,
  stimulationHighAmount: 2,
  premiumPerLiter: 19,
};

test('stimulationPerLiter follows thresholds', () => {
  const constants = testConstants;

  assert.equal(stimulationPerLiter(constants.stimulationLowThreshold, constants), 0);
  assert.equal(stimulationPerLiter(constants.stimulationLowThreshold + 1, constants), constants.stimulationLowAmount);
  assert.equal(stimulationPerLiter(constants.stimulationHighThreshold, constants), constants.stimulationLowAmount);
  assert.equal(stimulationPerLiter(constants.stimulationHighThreshold + 1, constants), constants.stimulationHighAmount);
});

test('average returns zero for empty array and mean for populated array', () => {
  assert.equal(average([]), 0);
  assert.equal(average([3.4, 3.8, 4.0]), 3.733333333333333);
});

test('price helpers return expected per-liter values', () => {
  assert.equal(pricePerLiterByFat(3.5, testConstants), 42);
  assert.equal(priceWithTaxPerLiter(42, testConstants), 45.36);
});

test('monthlyTotalAmount returns consistent financial values', () => {
  const constants = testConstants;

  const result = monthlyTotalAmount(1000, 3.5, constants);
  assert.equal(result.pricePerQty, 42);
  assert.equal(result.priceWithTax, 45.36);
  assert.equal(result.stimulation, 1);
  assert.equal(result.totalAmount, 46360);
});

test('quarterlyTotalPremium uses qty * premiumPerLiter', () => {
  assert.equal(quarterlyTotalPremium(1200, 19), 22800);
});

test('monthlyTotalAmount returns zero stimulation below thresholds', () => {
  const result = monthlyTotalAmount(400, 4.0, testConstants);

  assert.equal(result.pricePerQty, 48);
  assert.equal(result.priceWithTax, 51.84);
  assert.equal(result.stimulation, 0);
  assert.equal(result.totalAmount, 20736);
});
