import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildPriceWithTaxHeaderLabel,
  buildPriceWithTaxMultilineLabel,
  buildPriceWithTaxRateSuffix,
  calculateDisplayedTotalPricePerLiter,
  calculateDisplayedTotalPricePerLiterFromComponents,
  formatTaxRateForLabel,
} from '../lib/utils/price-display.ts';

test('formatTaxRateForLabel trims trailing zeros for non-integer values', () => {
  assert.equal(formatTaxRateForLabel(8), '8');
  assert.equal(formatTaxRateForLabel(8.5), '8.5');
  assert.equal(formatTaxRateForLabel(8.25), '8.25');
});

test('buildPriceWithTaxHeaderLabel appends distinct tax rates to the base label', () => {
  assert.equal(buildPriceWithTaxHeaderLabel('Ukupna cena sa PDV', [8, 8, 8]), 'Ukupna cena sa PDV (8%)');
  assert.equal(buildPriceWithTaxHeaderLabel('Ukupna cena sa PDV', [8, 10]), 'Ukupna cena sa PDV (8% / 10%)');
  assert.equal(
    buildPriceWithTaxHeaderLabel('Ukupna cena sa PDV', [8, 7.999999, 8.000001]),
    'Ukupna cena sa PDV (8%)'
  );
});

test('buildPriceWithTaxRateSuffix returns compact parenthesized tax rates', () => {
  assert.equal(buildPriceWithTaxRateSuffix([8, 8]), '(8%)');
  assert.equal(buildPriceWithTaxRateSuffix([8, 10]), '(8% / 10%)');
  assert.equal(buildPriceWithTaxRateSuffix([]), '');
});

test('buildPriceWithTaxMultilineLabel splits the tax suffix onto a new line', () => {
  assert.equal(buildPriceWithTaxMultilineLabel('Ukupna cena', 'sa PDV', [8]), 'Ukupna cena\nsa PDV (8%)');
  assert.equal(buildPriceWithTaxMultilineLabel('Ukupna cena', 'sa PDV', []), 'Ukupna cena\nsa PDV');
});

test('buildPriceWithTaxHeaderLabel keeps the base label when no valid tax rates exist', () => {
  assert.equal(buildPriceWithTaxHeaderLabel('Ukupna cena sa PDV', []), 'Ukupna cena sa PDV');
  assert.equal(buildPriceWithTaxHeaderLabel('Ukupna cena sa PDV', [0, Number.NaN]), 'Ukupna cena sa PDV');
});

test('calculateDisplayedTotalPricePerLiter derives the shown price from total amount and quantity', () => {
  assert.equal(calculateDisplayedTotalPricePerLiter(28282.068, 853), 33.156);
  assert.equal(calculateDisplayedTotalPricePerLiter(0, 0), 0);
});

test('calculateDisplayedTotalPricePerLiterFromComponents matches old and new pricing rules', () => {
  assert.equal(calculateDisplayedTotalPricePerLiterFromComponents(32.08, 1, 8, '2026-04-01'), 33.16);
  assert.equal(calculateDisplayedTotalPricePerLiterFromComponents(32.08, 1, 8, '2026-03-31'), 33.08);
});
