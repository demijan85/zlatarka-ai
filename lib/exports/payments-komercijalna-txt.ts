import type { MonthlySummaryRow } from '../../types/domain';
import type { MonthlyExportPeriod } from '../utils/export-file-names';

const PAYER_ACCOUNT_ID = '205000000007626228';
const PAYER_NAME = 'ZLATARKA DOO';
const PAYER_PLACE = '31320 NOVA';
const APP_NAME = 'MULTI E-BANK';
const PAYMENT_FORM = '2';
const PAYMENT_CODE = '20';
const DOCUMENT_TYPE = '0';
const ITEM_TYPE = '1';
const URGENT_PAYMENT = '0';

// Halcom DPP spec allows model/reference fields to be omitted. We keep them blank
// until the bank confirms the exact values that should be populated for Zlatarka.
const DEBIT_REFERENCE_MODEL = '';
const DEBIT_REFERENCE = '';
const CREDIT_REFERENCE_MODEL = '';
const CREDIT_REFERENCE = '';

function normalizeAsciiUpper(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'dj')
    .replace(/Đ/g, 'DJ')
    .replace(/[^\x20-\x7E]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLocaleUpperCase('sr-RS');
}

function onlyDigits(value: string): string {
  return value.replace(/\D/g, '');
}

function fitRight(value: string, width: number): string {
  return value.slice(0, width).padEnd(width, ' ');
}

function fitLeft(value: string, width: number): string {
  return value.slice(0, width).padStart(width, '0');
}

function fitBlankOrRight(value: string, width: number): string {
  const normalized = normalizeAsciiUpper(value);
  if (!normalized) return ''.padEnd(width, ' ');
  return fitRight(normalized, width);
}

function formatDateDDMMYY(date: Date): string {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = String(date.getFullYear()).slice(-2);
  return `${day}${month}${year}`;
}

function amountToBankUnits(value: number): string {
  return fitLeft(String(Math.round(value * 100)), 13);
}

function totalToBankUnits(value: number): string {
  return fitLeft(String(Math.round(value * 100)), 15);
}

function formatRecipientName(row: MonthlySummaryRow): string {
  return fitRight(normalizeAsciiUpper(`${row.lastName} ${row.firstName}`.trim()), 35);
}

function formatRecipientAddress(row: MonthlySummaryRow): string {
  return fitRight(normalizeAsciiUpper(row.street?.trim() || '-'), 35);
}

function formatRecipientPlace(row: MonthlySummaryRow): string {
  return fitRight(normalizeAsciiUpper(row.city?.trim() || '-'), 10);
}

function buildPurpose(year: number, month: number, period: MonthlyExportPeriod): string {
  const monthPart = String(month).padStart(2, '0');
  const suffix = period === 'first' ? ' PRVI DEO' : period === 'second' ? ' DRUGI DEO' : '';
  return fitRight(normalizeAsciiUpper(`OTKUP MLEKA ${monthPart}/${year}${suffix}`), 36);
}

function buildHeaderLine(date: Date): string {
  return (
    PAYER_ACCOUNT_ID +
    fitRight(normalizeAsciiUpper(PAYER_NAME), 35) +
    fitRight(normalizeAsciiUpper(PAYER_PLACE), 10) +
    formatDateDDMMYY(date) +
    ''.padEnd(98, ' ') +
    APP_NAME +
    '0'
  );
}

function buildSummaryLine(totalAmount: number, count: number): string {
  return (
    PAYER_ACCOUNT_ID +
    fitRight(normalizeAsciiUpper(PAYER_NAME), 35) +
    fitRight(normalizeAsciiUpper(PAYER_PLACE), 10) +
    totalToBankUnits(totalAmount) +
    fitLeft(String(count), 5) +
    ''.padEnd(96, ' ') +
    '9'
  );
}

function buildPaymentLine(row: MonthlySummaryRow, executionDate: Date, purpose: string): string {
  const account = onlyDigits(row.bankAccount?.trim() || '');
  if (account.length !== 18) {
    throw new Error(`Neispravan račun za Komercijalnu banku: ${row.lastName} ${row.firstName}`);
  }

  return (
    account +
    formatRecipientName(row) +
    formatRecipientAddress(row) +
    formatRecipientPlace(row) +
    '0' +
    fitBlankOrRight(DEBIT_REFERENCE_MODEL, 2) +
    fitBlankOrRight(DEBIT_REFERENCE, 23) +
    purpose +
    '00000' +
    ' ' +
    PAYMENT_FORM +
    PAYMENT_CODE +
    '  ' +
    amountToBankUnits(Number(row.totalAmount || 0)) +
    fitBlankOrRight(CREDIT_REFERENCE_MODEL, 2) +
    fitBlankOrRight(CREDIT_REFERENCE, 23) +
    formatDateDDMMYY(executionDate) +
    DOCUMENT_TYPE +
    ITEM_TYPE +
    URGENT_PAYMENT
  );
}

export function buildKomercijalnaPaymentsTxt(
  rows: MonthlySummaryRow[],
  executionDate: Date,
  options: { year: number; month: number; period: MonthlyExportPeriod }
): string {
  const purpose = buildPurpose(options.year, options.month, options.period);
  const lines = [
    buildHeaderLine(executionDate),
    buildSummaryLine(rows.reduce((sum, row) => sum + Number(row.totalAmount || 0), 0), rows.length),
    ...rows.map((row) => buildPaymentLine(row, executionDate, purpose)),
  ];

  return `${lines.join('\r\n')}\r\n\x1A`;
}

export function encodeKomercijalnaPaymentsTxt(content: string): ArrayBuffer {
  const source = Buffer.from(content, 'latin1');
  const view = new Uint8Array(source.length);
  view.set(source);
  return view.buffer;
}
