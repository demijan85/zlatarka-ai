import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildKomercijalnaPaymentsTxt,
  encodeKomercijalnaPaymentsTxt,
} from '../lib/exports/payments-komercijalna-txt.ts';
import type { MonthlySummaryRow } from '../types/domain.ts';

const baseRow: MonthlySummaryRow = {
  serialNum: 1,
  supplierId: 7,
  firstName: 'Benjamin',
  lastName: 'Muratović',
  city: 'Nova Varoš',
  street: 'Komarani bb',
  zipCode: '31320',
  jmbg: null,
  bankAccount: '160-0000000924733-77',
  qty: 853,
  fatPct: 3.3,
  calculatedPricePerFatPct: 0,
  pricePerFatPct: 0,
  calculatedPricePerQty: 0,
  pricePerQty: 0,
  taxPercentage: 8,
  calculatedPriceWithTax: 0,
  priceWithTax: 0,
  calculatedStimulation: 0,
  stimulation: 0,
  totalAmount: 28282.07,
  priceWithTaxOverride: null,
  stimulationOverride: null,
};

test('buildKomercijalnaPaymentsTxt creates fixed-width header, summary and payment lines', () => {
  const content = buildKomercijalnaPaymentsTxt([baseRow], new Date('2026-05-19T09:15:00'), {
    year: 2026,
    month: 5,
    period: 'all',
  });

  const lines = content.split('\r\n');
  assert.equal(lines[0].length, 180);
  assert.equal(lines[1].length, 180);
  assert.equal(lines[2].length, 218);
  assert.equal(lines[3], '\x1A');

  assert.match(lines[0], /^205000000007626228ZLATARKA DOO/);
  assert.match(lines[0], /190526/);
  assert.match(lines[0], /MULTI E-BANK0$/);

  assert.match(lines[1], /^205000000007626228ZLATARKA DOO/);
  assert.match(lines[1], /00000000282820700001/);
  assert.equal(lines[1][179], '9');

  assert.match(lines[2], /^160000000092473377MURATOVIC BENJAMIN/);
  assert.match(lines[2], /KOMARANI BB/);
  assert.match(lines[2], /NOVA VAROS0/);
  assert.match(lines[2], /OTKUP MLEKA 05\/2026/);
  assert.equal(lines[2].slice(98, 99), '0');
  assert.equal(lines[2].slice(99, 101), '  ');
  assert.equal(lines[2].slice(101, 124), ''.padEnd(23, ' '));
  assert.equal(lines[2].slice(165, 171), ' 220  ');
  assert.equal(lines[2].slice(171, 184), '0000002828207');
  assert.equal(lines[2].slice(184, 186), '  ');
  assert.equal(lines[2].slice(186, 209), ''.padEnd(23, ' '));
  assert.match(lines[2], /190526010$/);
});

test('encodeKomercijalnaPaymentsTxt keeps ascii file contents unchanged', () => {
  const content = 'TEST\r\n\x1A';
  const payload = encodeKomercijalnaPaymentsTxt(content);

  assert.equal(Buffer.from(payload).toString('latin1'), content);
});

test('buildKomercijalnaPaymentsTxt uses readable Serbian labels for split-month purposes', () => {
  const firstPart = buildKomercijalnaPaymentsTxt([baseRow], new Date('2026-05-19T09:15:00'), {
    year: 2026,
    month: 5,
    period: 'first',
  });
  const secondPart = buildKomercijalnaPaymentsTxt([baseRow], new Date('2026-05-19T09:15:00'), {
    year: 2026,
    month: 5,
    period: 'second',
  });

  const firstPaymentLine = firstPart.split('\r\n')[2];
  const secondPaymentLine = secondPart.split('\r\n')[2];

  assert.match(firstPaymentLine, /OTKUP MLEKA 05\/2026 PRVI DEO/);
  assert.match(secondPaymentLine, /OTKUP MLEKA 05\/2026 DRUGI DEO/);
});

test('buildKomercijalnaPaymentsTxt supports quarterly premium purposes', () => {
  const content = buildKomercijalnaPaymentsTxt([baseRow], new Date('2026-05-19T09:15:00'), {
    purpose: 'Premija, prvi kvartal 2026',
  });

  const paymentLine = content.split('\r\n')[2];
  assert.match(paymentLine, /PREMIJA, PRVI KVARTAL 2026/);
});
