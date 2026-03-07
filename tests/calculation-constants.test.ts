import test from 'node:test';
import assert from 'node:assert/strict';
import {
  defaultCalculationConstants,
  defaultVersionedConstants,
  getEffectiveConstantsForPeriod,
  normalizeConstants,
  normalizeVersionedConstants,
  sortVersions,
  toCalculationConstants,
  type VersionedCalculationConstants,
} from '../lib/constants/calculation.ts';

test('normalizeConstants falls back to defaults for invalid payload', () => {
  assert.deepEqual(normalizeConstants({ taxPercentage: -1 }), defaultCalculationConstants);
});

test('normalizeConstants clamps high threshold to low threshold when reversed', () => {
  const normalized = normalizeConstants({
    pricePerFatPct: 12,
    taxPercentage: 8,
    stimulationLowThreshold: 800,
    stimulationHighThreshold: 500,
    stimulationLowAmount: 1,
    stimulationHighAmount: 2,
    premiumPerLiter: 19,
  });

  assert.equal(normalized.stimulationLowThreshold, 800);
  assert.equal(normalized.stimulationHighThreshold, 800);
});

test('normalizeVersionedConstants preserves validFrom and applies normalization', () => {
  const normalized = normalizeVersionedConstants({
    validFrom: '2025-04',
    pricePerFatPct: 12,
    taxPercentage: 8,
    stimulationLowThreshold: 1000,
    stimulationHighThreshold: 900,
    stimulationLowAmount: 1,
    stimulationHighAmount: 2,
    premiumPerLiter: 19,
  });

  assert.equal(normalized.validFrom, '2025-04');
  assert.equal(normalized.stimulationHighThreshold, 1000);
});

test('sortVersions orders constants by validFrom ascending', () => {
  const versions: VersionedCalculationConstants[] = [
    { ...defaultVersionedConstants, validFrom: '2025-06' },
    { ...defaultVersionedConstants, validFrom: '2024-01' },
    { ...defaultVersionedConstants, validFrom: '2025-01' },
  ];

  assert.deepEqual(
    sortVersions(versions).map((item) => item.validFrom),
    ['2024-01', '2025-01', '2025-06']
  );
});

test('getEffectiveConstantsForPeriod selects latest version not after period', () => {
  const versions: VersionedCalculationConstants[] = [
    { ...defaultVersionedConstants, validFrom: '2024-01', premiumPerLiter: 18 },
    { ...defaultVersionedConstants, validFrom: '2025-01', premiumPerLiter: 19 },
    { ...defaultVersionedConstants, validFrom: '2025-07', premiumPerLiter: 21 },
  ];

  assert.equal(getEffectiveConstantsForPeriod(versions, '2024-12').premiumPerLiter, 18);
  assert.equal(getEffectiveConstantsForPeriod(versions, '2025-03').premiumPerLiter, 19);
  assert.equal(getEffectiveConstantsForPeriod(versions, '2025-09').premiumPerLiter, 21);
});

test('getEffectiveConstantsForPeriod falls back to earliest version when period is before all versions', () => {
  const versions: VersionedCalculationConstants[] = [
    { ...defaultVersionedConstants, validFrom: '2024-05', premiumPerLiter: 17 },
    { ...defaultVersionedConstants, validFrom: '2025-01', premiumPerLiter: 19 },
  ];

  assert.equal(getEffectiveConstantsForPeriod(versions, '2024-01').premiumPerLiter, 17);
});

test('toCalculationConstants strips validFrom and keeps calculation fields', () => {
  const version = {
    validFrom: '2025-03',
    pricePerFatPct: 13,
    taxPercentage: 10,
    stimulationLowThreshold: 600,
    stimulationHighThreshold: 1200,
    stimulationLowAmount: 1.5,
    stimulationHighAmount: 2.5,
    premiumPerLiter: 20,
  };

  assert.deepEqual(toCalculationConstants(version), {
    pricePerFatPct: 13,
    taxPercentage: 10,
    stimulationLowThreshold: 600,
    stimulationHighThreshold: 1200,
    stimulationLowAmount: 1.5,
    stimulationHighAmount: 2.5,
    premiumPerLiter: 20,
  });
});
