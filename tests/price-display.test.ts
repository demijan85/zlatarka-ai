import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildPriceWithTaxHeaderLabel,
  buildPriceWithTaxMultilineLabel,
  buildPriceWithTaxRateSuffix,
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
