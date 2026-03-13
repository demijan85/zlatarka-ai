import type { MonthlySummaryRow } from '../../types/domain';

const PAYER_COMPANY_NAME = 'TATJANA JOKIĆ PR TRGOVINA NA VELIKO MLEČNIM PROIZVODIMA ZLATARKA KOMER';
const PAYER_COMPANY_CITY = 'KOMARANI BB,31320, NOVA VAROŠ';
const PAYER_ACCOUNT_ID = '160-6000002047522-08';
const PAYER_BANK_NAME = 'Banca Intesa ad Beograd';

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

export function formatPaymentDateTime(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(
    date.getMinutes()
  )}:${pad(date.getSeconds())}`;
}

function normalizePaymentName(value: string): string {
  return value
    .replace(/\s+/g, ' ')
    .trim()
    .toLocaleUpperCase('sr-RS');
}

function formatPayeeName(row: MonthlySummaryRow): string {
  return normalizePaymentName(`${row.lastName} ${row.firstName}`.trim());
}

function formatPayeeCity(row: MonthlySummaryRow): string {
  const street = normalizePaymentName(row.street?.trim() || '-');
  const zipCode = normalizePaymentName(row.zipCode?.trim() || '-');
  const city = normalizePaymentName(row.city?.trim() || '-');
  return `${street},${zipCode},${city}`;
}

export function buildPaymentsXml(rows: MonthlySummaryRow[], dueDate: Date): string {
  const due = formatPaymentDateTime(dueDate);
  const orders = rows
    .map((row) => {
      const amount = Number(row.totalAmount || 0);

      return (
        '<pmtorder>' +
        '<companyinfo>' +
        `<name>${escapeXml(PAYER_COMPANY_NAME)}</name>` +
        `<city>${escapeXml(PAYER_COMPANY_CITY)}</city>` +
        '</companyinfo>' +
        '<accountinfo>' +
        `<acctid>${escapeXml(PAYER_ACCOUNT_ID)}</acctid>` +
        '<bankid />' +
        `<bankname>${escapeXml(PAYER_BANK_NAME)}</bankname>` +
        '</accountinfo>' +
        '<payeecompanyinfo>' +
        `<name>${escapeXml(formatPayeeName(row))}</name>` +
        `<city>${escapeXml(formatPayeeCity(row))}</city>` +
        '</payeecompanyinfo>' +
        '<payeeaccountinfo>' +
        `<acctid>${escapeXml(row.bankAccount?.trim() || '')}</acctid>` +
        '<bankid />' +
        '<bankname />' +
        '</payeeaccountinfo>' +
        '<trntype>ibank.payment.pp3</trntype>' +
        `<trnuid>${crypto.randomUUID()}</trnuid>` +
        `<dtdue>${due}</dtdue>` +
        `<trnamt>${amount.toFixed(2)}</trnamt>` +
        '<purpose>Promet robe i usluga - medjufazna potrosnja</purpose>' +
        '<purposecode>220</purposecode>' +
        '<curdef>RSD</curdef>' +
        '<refmodel />' +
        '<refnumber />' +
        '<payeerefmodel />' +
        '<payeerefnumber />' +
        '<urgency>ACH</urgency>' +
        '<priority>0</priority>' +
        '<taxid />' +
        '<fitid />' +
        '<properties><notification><channel>ibank.rc</channel></notification></properties>' +
        '</pmtorder>'
      );
    })
    .join('');

  return `<pmtorderrq>${orders}</pmtorderrq>`;
}

export function encodePaymentsXml(xml: string): ArrayBuffer {
  const source = Buffer.from(`\uFEFF${xml}`, 'utf16le');
  const view = new Uint8Array(source.length);
  view.set(source);
  return view.buffer;
}
