import { NextResponse } from 'next/server';
import { getEffectiveCalculationConstantsForYearMonth } from '@/lib/repositories/calculation-constants';
import { getMonthlySummaries } from '@/lib/repositories/summaries';
import type { MonthlySummaryRow } from '@/types/domain';
import { getMonthlyExportFileName, normalizeExportLanguage } from '@/lib/utils/export-file-names';
import { parseMonth, parseYear } from '@/lib/utils/date';
import { normalizePeriod } from '@/lib/utils/period';
import { yearMonthFrom } from '@/lib/utils/year-month';

const A4_WIDTH = 595;
const A4_HEIGHT = 842;
const PAGE_MARGIN = 24;
const RECEIPTS_PER_PAGE = 3;
const RECEIPT_GAP = 12;
const RECEIPT_HEIGHT = (A4_HEIGHT - PAGE_MARGIN * 2 - RECEIPT_GAP * (RECEIPTS_PER_PAGE - 1)) / RECEIPTS_PER_PAGE;

function round2(value: number): number {
  return Number(value.toFixed(2));
}

function formatDate(value: Date): string {
  return value.toLocaleDateString('sr-RS');
}

function normalizeText(value: string): string {
  const cyrillicToLatin: Record<string, string> = {
    А: 'A',
    Б: 'B',
    В: 'V',
    Г: 'G',
    Д: 'D',
    Ђ: 'Dj',
    Е: 'E',
    Ж: 'Z',
    З: 'Z',
    И: 'I',
    Ј: 'J',
    К: 'K',
    Л: 'L',
    Љ: 'Lj',
    М: 'M',
    Н: 'N',
    Њ: 'Nj',
    О: 'O',
    П: 'P',
    Р: 'R',
    С: 'S',
    Т: 'T',
    Ћ: 'C',
    У: 'U',
    Ф: 'F',
    Х: 'H',
    Ц: 'C',
    Ч: 'C',
    Џ: 'Dz',
    Ш: 'S',
    а: 'a',
    б: 'b',
    в: 'v',
    г: 'g',
    д: 'd',
    ђ: 'dj',
    е: 'e',
    ж: 'z',
    з: 'z',
    и: 'i',
    ј: 'j',
    к: 'k',
    л: 'l',
    љ: 'lj',
    м: 'm',
    н: 'n',
    њ: 'nj',
    о: 'o',
    п: 'p',
    р: 'r',
    с: 's',
    т: 't',
    ћ: 'c',
    у: 'u',
    ф: 'f',
    х: 'h',
    ц: 'c',
    ч: 'c',
    џ: 'dz',
    ш: 's',
  };

  const latinized = Array.from(value)
    .map((char) => cyrillicToLatin[char] ?? char)
    .join('');

  return latinized
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'dj')
    .replace(/Đ/g, 'Dj')
    .replace(/[^\x20-\x7E]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapePdfText(value: string): string {
  return normalizeText(value)
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

function textCmd(text: string, x: number, y: number, size = 10, bold = false): string {
  const font = bold ? '/F2' : '/F1';
  return `BT ${font} ${size} Tf 1 0 0 1 ${x.toFixed(2)} ${y.toFixed(2)} Tm (${escapePdfText(text)}) Tj ET\n`;
}

function textWidthApprox(text: string, size: number): number {
  return text.length * size * 0.5;
}

function centerTextCmd(text: string, centerX: number, y: number, size = 10, bold = false): string {
  return textCmd(text, centerX - textWidthApprox(text, size) / 2, y, size, bold);
}

function rightTextCmd(text: string, rightX: number, y: number, size = 10, bold = false): string {
  return textCmd(text, rightX - textWidthApprox(text, size), y, size, bold);
}

function clampText(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, Math.max(0, maxLength - 3))}...`;
}

function lineCmd(x1: number, y1: number, x2: number, y2: number): string {
  return `${x1.toFixed(2)} ${y1.toFixed(2)} m ${x2.toFixed(2)} ${y2.toFixed(2)} l S\n`;
}

function rectCmd(x: number, y: number, w: number, h: number): string {
  return `${x.toFixed(2)} ${y.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re S\n`;
}

function buildReceiptContent(row: MonthlySummaryRow, year: number, month: number, now: Date, indexOnPage: number): string {
  const x = PAGE_MARGIN;
  const w = A4_WIDTH - PAGE_MARGIN * 2;
  const rightBlockX = x + Math.round(w * 0.57);
  const topY = A4_HEIGHT - PAGE_MARGIN - indexOnPage * (RECEIPT_HEIGHT + RECEIPT_GAP);

  // Receipt calculation follows original print layout: milk + stimulation => base, then PDV on base.
  const milkAmount = round2(row.qty * row.pricePerQty);
  const stimulationPerLiter = round2(row.stimulation);
  const stimulationAmount = round2(row.qty * stimulationPerLiter);
  const baseAmount = round2(milkAmount + stimulationAmount);
  const taxAmount = round2(baseAmount * (row.taxPercentage / 100));
  const totalAmount = round2(baseAmount + taxAmount);
  const pricePerLiterWithStimulation = round2(row.pricePerQty + stimulationPerLiter);

  const location = [row.city, row.street].filter(Boolean).join(', ');
  const fullName = clampText(`${row.firstName} ${row.lastName}`.trim(), 32);
  const printableLocation = clampText(location || '-', 30);

  let c = '0.45 w\n';

  c += textCmd('Zlatarka DOO', x, topY - 14, 11, true);
  c += textCmd('Otkup od poljoprivrednika:', rightBlockX, topY - 14, 11, true);
  c += textCmd('Komarani, Nova Varos', x, topY - 30, 10);
  c += textCmd(`Ime i prezime: ${fullName}`, rightBlockX, topY - 30, 10, true);
  c += textCmd('PIB: 101067180, MB: 17393103', x, topY - 46, 10);
  c += textCmd(`Lokacija: ${printableLocation}`, rightBlockX, topY - 46, 10);
  c += textCmd('Sifra delatnosti: 1510', x, topY - 62, 10);
  c += textCmd(`JMBG: ${row.jmbg ?? ''}`, rightBlockX, topY - 62, 10, true);

  c += centerTextCmd(`OBRACUN MLEKA ZA PERIOD ${year}/${String(month).padStart(2, '0')}`, x + w / 2, topY - 94, 14.5, true);

  const qtyRowY = topY - 126;
  const qtyRowH = 24;
  c += rectCmd(x, qtyRowY, w, qtyRowH);
  c += lineCmd(x + w / 3, qtyRowY, x + w / 3, qtyRowY + qtyRowH);
  c += lineCmd(x + (2 * w) / 3, qtyRowY, x + (2 * w) / 3, qtyRowY + qtyRowH);
  c += textCmd(`Kolicina mleka: ${round2(row.qty)} litara`, x + 4, qtyRowY + 7, 9);
  c += textCmd(`% mlecne masti: ${round2(row.fatPct)}`, x + w / 3 + 4, qtyRowY + 7, 9);
  c += textCmd(`Ukupna cena po litru: ${pricePerLiterWithStimulation.toFixed(1)}`, x + (2 * w) / 3 + 4, qtyRowY + 7, 9);

  const tableX = x;
  const tableY = topY - 196;
  const tableW = w;
  const tableH = 64;
  const colWidths = [58, 58, 64, 64, 112, 64, 127];
  const splitValuesY = tableY + 18;
  const splitSubHeaderY = tableY + 36;
  const firstGroupsWidth = colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3];

  c += rectCmd(tableX, tableY, tableW, tableH);
  let cursorX = tableX;
  for (let i = 0; i < colWidths.length - 1; i += 1) {
    cursorX += colWidths[i];
    const splitPairColumn = i === 0 || i === 2;
    if (splitPairColumn) {
      c += lineCmd(cursorX, tableY, cursorX, splitSubHeaderY);
    } else {
      c += lineCmd(cursorX, tableY, cursorX, tableY + tableH);
    }
  }
  c += lineCmd(tableX, splitSubHeaderY, tableX + firstGroupsWidth, splitSubHeaderY);
  c += lineCmd(tableX, splitValuesY, tableX + tableW, splitValuesY);

  c += textCmd('Iznos za mleko', tableX + 10, splitSubHeaderY + 9, 8.5, true);
  c += textCmd('Stimulacija za kolicinu', tableX + colWidths[0] + colWidths[1] + 8, splitSubHeaderY + 9, 8.5, true);
  c += textCmd('Osnovica dinara', tableX + firstGroupsWidth + 14, splitSubHeaderY + 8, 10.5, true);
  c += textCmd('PDV', tableX + firstGroupsWidth + colWidths[4] + 22, splitSubHeaderY + 8, 10.5, true);
  c += textCmd('Ukupno', tableX + tableW - 58, splitSubHeaderY + 8, 10.5, true);

  c += textCmd('cen po l', tableX + 10, splitValuesY + 5, 9);
  c += textCmd('ukupno', tableX + colWidths[0] + 12, splitValuesY + 5, 9);
  c += textCmd('po litri', tableX + colWidths[0] + colWidths[1] + 12, splitValuesY + 5, 9);
  c += textCmd('iznos', tableX + colWidths[0] + colWidths[1] + colWidths[2] + 18, splitValuesY + 5, 9);

  const c1 = row.pricePerQty.toFixed(1);
  const c2 = milkAmount.toFixed(1);
  const c3 = stimulationPerLiter.toFixed(0);
  const c4 = stimulationAmount.toFixed(0);
  const c5 = baseAmount.toFixed(1);
  const c6 = taxAmount.toFixed(0);
  const c7 = totalAmount.toFixed(0);

  c += rightTextCmd(c1, tableX + colWidths[0] - 8, tableY + 6, 10);
  c += rightTextCmd(c2, tableX + colWidths[0] + colWidths[1] - 8, tableY + 6, 10);
  c += rightTextCmd(c3, tableX + colWidths[0] + colWidths[1] + colWidths[2] - 8, tableY + 6, 10);
  c += rightTextCmd(c4, tableX + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] - 8, tableY + 6, 10);
  c += rightTextCmd(c5, tableX + firstGroupsWidth + colWidths[4] - 8, tableY + 6, 10);
  c += rightTextCmd(c6, tableX + firstGroupsWidth + colWidths[4] + colWidths[5] - 8, tableY + 6, 10);
  c += rightTextCmd(c7, tableX + tableW - 8, tableY + 6, 10, true);

  c += textCmd(
    'Izjavljujem da sam obveznik poreza na dohodak gradjana na prihode od poljoprivrede i sumarstva na osnovu katastarskog prihoda.',
    x,
    topY - 218,
    8
  );

  c += lineCmd(x, topY - 224, x + w, topY - 224);
  c += textCmd(`Datum: ${formatDate(now)}`, x, topY - 238, 11);
  c += textCmd('Potpis proizvodjaca:', rightBlockX, topY - 238, 11);
  c += lineCmd(rightBlockX + 102, topY - 236, x + w - 10, topY - 236);

  if (indexOnPage < RECEIPTS_PER_PAGE - 1) {
    c += lineCmd(x, topY - RECEIPT_HEIGHT + 6, x + w, topY - RECEIPT_HEIGHT + 6);
  }

  return c;
}

function buildPdfDocument(pageContents: string[]): Buffer {
  const objects: Buffer[] = [];

  function addObject(content: string | Buffer): number {
    const buffer = Buffer.isBuffer(content) ? content : Buffer.from(content, 'binary');
    objects.push(buffer);
    return objects.length;
  }

  const fontRegularId = addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  const fontBoldId = addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>');

  const pagesId = addObject('');
  const pageIds: number[] = [];

  for (const pageContent of pageContents) {
    const stream = Buffer.from(pageContent, 'binary');
    const contentId = addObject(
      Buffer.concat([
        Buffer.from(`<< /Length ${stream.length} >>\nstream\n`, 'binary'),
        stream,
        Buffer.from('\nendstream', 'binary'),
      ])
    );

    const pageId = addObject(
      `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${A4_WIDTH} ${A4_HEIGHT}] /Contents ${contentId} 0 R /Resources << /Font << /F1 ${fontRegularId} 0 R /F2 ${fontBoldId} 0 R >> >> >>`
    );

    pageIds.push(pageId);
  }

  objects[pagesId - 1] = Buffer.from(
    `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`,
    'binary'
  );

  const catalogId = addObject(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`);

  const parts: Buffer[] = [Buffer.from('%PDF-1.4\n%\xFF\xFF\xFF\xFF\n', 'binary')];
  const offsets: number[] = [0];
  let currentOffset = parts[0].length;

  objects.forEach((object, idx) => {
    const id = idx + 1;
    const header = Buffer.from(`${id} 0 obj\n`, 'binary');
    const footer = Buffer.from('\nendobj\n', 'binary');
    offsets[id] = currentOffset;
    parts.push(header, object, footer);
    currentOffset += header.length + object.length + footer.length;
  });

  const xrefOffset = currentOffset;
  let xref = `xref\n0 ${objects.length + 1}\n`;
  xref += '0000000000 65535 f \n';
  for (let i = 1; i <= objects.length; i += 1) {
    xref += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }

  const trailer = `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  parts.push(Buffer.from(xref + trailer, 'binary'));

  return Buffer.concat(parts);
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const now = new Date();
    const year = parseYear(searchParams.get('year'), now.getFullYear());
    const month = parseMonth(searchParams.get('month'), now.getMonth() + 1);
    const period = normalizePeriod(searchParams.get('period'));
    const city = searchParams.get('city') || undefined;
    const language = normalizeExportLanguage(searchParams.get('lang'));

    const constants = await getEffectiveCalculationConstantsForYearMonth(yearMonthFrom(year, month));
    const summaries = (await getMonthlySummaries({ year, month, city, period, constants })).filter(
      (row) => Number.isFinite(row.qty) && row.qty > 0
    );

    const pageContents: string[] = [];
    let currentPage = '';

    summaries.forEach((row, index) => {
      const indexOnPage = index % RECEIPTS_PER_PAGE;
      currentPage += buildReceiptContent(row, year, month, now, indexOnPage);
      if (indexOnPage === RECEIPTS_PER_PAGE - 1) {
        pageContents.push(currentPage);
        currentPage = '';
      }
    });

    if (currentPage) {
      pageContents.push(currentPage);
    }

    if (!pageContents.length) {
      pageContents.push(textCmd(`Nema podataka za period ${year}/${String(month).padStart(2, '0')}`, PAGE_MARGIN, A4_HEIGHT - 60, 12, true));
    }

    const pdf = buildPdfDocument(pageContents);
    const pdfBody = new Uint8Array(pdf);

    return new NextResponse(pdfBody, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${getMonthlyExportFileName('receipts', year, month, language, period)}"`,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
