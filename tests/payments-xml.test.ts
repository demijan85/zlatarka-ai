import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPaymentsXml, encodePaymentsXml, formatPaymentDateTime } from '../lib/exports/payments-xml.ts';
import type { MonthlySummaryRow } from '../types/domain.ts';

const baseRow: MonthlySummaryRow = {
  serialNum: 1,
  supplierId: 99,
  firstName: 'Dejan',
  lastName: 'Popović',
  city: 'Beograd',
  street: 'Nehruova 50',
  zipCode: null,
  jmbg: null,
  bankAccount: '205-9001018923709-57',
  qty: 100,
  fatPct: 4.2,
  pricePerFatPct: 0,
  pricePerQty: 0,
  taxPercentage: 0,
  priceWithTax: 0,
  stimulation: 0,
  totalAmount: 200,
};

test('buildPaymentsXml matches expected payment structure', () => {
  const xml = buildPaymentsXml([baseRow], new Date('2026-03-13T14:57:47'));

  assert.match(xml, /^<pmtorderrq><pmtorder>/);
  assert.match(xml, /<name>TATJANA JOKIĆ PR TRGOVINA NA VELIKO MLEČNIM PROIZVODIMA ZLATARKA KOMER<\/name>/);
  assert.match(xml, /<acctid>160-6000002047522-08<\/acctid>/);
  assert.match(xml, /<name>POPOVIĆ DEJAN<\/name>/);
  assert.match(xml, /<city>NEHRUOVA 50,-,BEOGRAD<\/city>/);
  assert.match(xml, /<acctid>205-9001018923709-57<\/acctid>/);
  assert.match(xml, /<dtdue>2026-03-13T14:57:47<\/dtdue>/);
  assert.match(xml, /<trnamt>200.00<\/trnamt>/);
  assert.match(xml, /<urgency>ACH<\/urgency>/);
  assert.match(xml, /<channel>ibank\.rc<\/channel>/);
  assert.match(xml, /<\/pmtorder><\/pmtorderrq>$/);
});

test('formatPaymentDateTime returns local datetime without timezone', () => {
  assert.equal(formatPaymentDateTime(new Date('2026-03-13T14:57:47')), '2026-03-13T14:57:47');
});

test('encodePaymentsXml produces utf16le payload with BOM', () => {
  const payload = encodePaymentsXml('<pmtorderrq />');
  const bytes = new Uint8Array(payload);

  assert.equal(bytes[0], 0xff);
  assert.equal(bytes[1], 0xfe);
  assert.equal(Buffer.from(payload).toString('utf16le'), '\uFEFF<pmtorderrq />');
});
