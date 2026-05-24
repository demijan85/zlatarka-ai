import test from 'node:test';
import assert from 'node:assert/strict';
import { getMonthlyExportFileName, getQuarterlyExportFileName } from '../lib/utils/export-file-names.ts';

test('getMonthlyExportFileName supports Komercijalna TXT payments export', () => {
  assert.equal(
    getMonthlyExportFileName('payments-komercijalna', 2026, 5, 'sr-Cyrl', 'all'),
    'placanja_komercijalna_2026_05.txt'
  );
  assert.equal(
    getMonthlyExportFileName('payments-komercijalna', 2026, 5, 'en', 'second'),
    'payments_komercijalna_2026_05_second_half.txt'
  );
});

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
