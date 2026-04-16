import test from 'node:test';
import assert from 'node:assert/strict';
import {
  TAX_ON_STIMULATION_VALID_FROM,
  applyMonthlySummaryOverrides,
  average,
  monthlyTotalAmount,
  pricePerLiterByFat,
  priceWithTaxPerLiter,
  quarterlyTotalPremium,
  stimulationPerLiter,
  usesTaxOnStimulation,
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

test('usesTaxOnStimulation switches on starting April 1, 2026', () => {
  assert.equal(usesTaxOnStimulation('2026-03-31'), false);
  assert.equal(usesTaxOnStimulation(TAX_ON_STIMULATION_VALID_FROM), true);
});

test('monthlyTotalAmount keeps legacy calculation before April 2026', () => {
  const constants = testConstants;

  const result = monthlyTotalAmount(1000, 3.5, constants, '2026-03-31');
  assert.equal(result.pricePerQty, 42);
  assert.equal(result.priceWithTax, 45.36);
  assert.equal(result.stimulation, 1);
  assert.equal(result.totalAmount, 46360);
});

test('monthlyTotalAmount applies tax to stimulation starting April 2026', () => {
  const result = monthlyTotalAmount(1000, 3.5, testConstants, '2026-04-01');

  assert.equal(result.pricePerQty, 42);
  assert.equal(result.priceWithTax, 45.36);
  assert.equal(result.stimulation, 1);
  assert.equal(result.totalAmount, 46440);
});

test('quarterlyTotalPremium uses qty * premiumPerLiter', () => {
  assert.equal(quarterlyTotalPremium(1200, 19), 22800);
});

test('monthlyTotalAmount returns zero stimulation below thresholds', () => {
  const result = monthlyTotalAmount(400, 4.0, testConstants, '2026-04-01');

  assert.equal(result.pricePerQty, 48);
  assert.equal(result.priceWithTax, 51.84);
  assert.equal(result.stimulation, 0);
  assert.equal(result.totalAmount, 20736);
});

test('applyMonthlySummaryOverrides keeps legacy total before April 2026', () => {
  const base = monthlyTotalAmount(1000, 3.5, testConstants, '2026-03-31');
  const result = applyMonthlySummaryOverrides(
    1000,
    3.5,
    {
      pricePerFatPct: testConstants.pricePerFatPct,
      pricePerQty: base.pricePerQty,
      priceWithTax: base.priceWithTax,
      stimulation: base.stimulation,
    },
    testConstants.taxPercentage,
    '2026-03-31',
    {
      priceWithTaxOverride: 54,
      stimulationOverride: 3,
    }
  );

  assert.equal(result.pricePerFatPct, 14.285714285714286);
  assert.equal(result.pricePerQty, 50);
  assert.equal(result.priceWithTax, 54);
  assert.equal(result.stimulation, 3);
  assert.equal(result.totalAmount, 57000);
});

test('applyMonthlySummaryOverrides taxes stimulation from April 2026 onward', () => {
  const base = monthlyTotalAmount(1000, 3.5, testConstants, '2026-04-01');
  const result = applyMonthlySummaryOverrides(
    1000,
    3.5,
    {
      pricePerFatPct: testConstants.pricePerFatPct,
      pricePerQty: base.pricePerQty,
      priceWithTax: base.priceWithTax,
      stimulation: base.stimulation,
    },
    testConstants.taxPercentage,
    '2026-04-01',
    {
      priceWithTaxOverride: 54,
      stimulationOverride: 3,
    }
  );

  assert.equal(result.pricePerFatPct, 14.285714285714286);
  assert.equal(result.pricePerQty, 50);
  assert.equal(result.priceWithTax, 54);
  assert.equal(result.stimulation, 3);
  assert.equal(result.totalAmount, 57240);
});
