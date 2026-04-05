import test from 'node:test';
import assert from 'node:assert/strict';
import { getQuarterlyExportFileName } from '../lib/utils/export-file-names.ts';

test('getQuarterlyExportFileName keeps the stable file name for complete quarters', () => {
  assert.equal(
    getQuarterlyExportFileName(2026, 1, '2026-03-31', '2026-03-31'),
    'quarterly_summary_2026_Q1.xlsx'
  );
});

test('getQuarterlyExportFileName appends the coverage date for incomplete quarters', () => {
  assert.equal(
    getQuarterlyExportFileName(2026, 1, '2026-03-26', '2026-03-31'),
    'quarterly_summary_2026_Q1_through_2026-03-26.xlsx'
  );
});
