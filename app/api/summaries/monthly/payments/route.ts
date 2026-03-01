import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { getEffectiveCalculationConstantsForYearMonth } from '@/lib/repositories/calculation-constants';
import { getMonthlySummaries } from '@/lib/repositories/summaries';
import { parseMonth, parseYear } from '@/lib/utils/date';
import { normalizePeriod } from '@/lib/utils/period';
import { escapeXml } from '@/lib/utils/xml';
import { yearMonthFrom } from '@/lib/utils/year-month';

function pad(value: number) {
  return String(value).padStart(2, '0');
}

function formatDateTime(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(
    date.getMinutes()
  )}:${pad(date.getSeconds())}`;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const now = new Date();
    const year = parseYear(searchParams.get('year'), now.getFullYear());
    const month = parseMonth(searchParams.get('month'), now.getMonth() + 1);
    const period = normalizePeriod(searchParams.get('period'));
    const city = searchParams.get('city') || undefined;

    const constants = await getEffectiveCalculationConstantsForYearMonth(yearMonthFrom(year, month));
    const summaries = await getMonthlySummaries({ year, month, city, period, constants });

    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<pmtorderrq>\n`;
    const due = formatDateTime(new Date());

    for (const row of summaries) {
      xml += `  <pmtorder>\n`;
      xml += `    <companyinfo>\n`;
      xml += `      <name>ZLATARKA DOO</name>\n`;
      xml += `      <city>KOMARANI BB,31320, NOVA VAROS</city>\n`;
      xml += `    </companyinfo>\n`;

      xml += `    <payeecompanyinfo>\n`;
      xml += `      <name>${escapeXml(`${row.lastName} ${row.firstName}`)}</name>\n`;
      xml += `      <city>${escapeXml(`${row.city ?? ''}, ${row.street ?? ''}`)}</city>\n`;
      xml += `    </payeecompanyinfo>\n`;

      xml += `    <payeeaccountinfo>\n`;
      xml += `      <acctid>${escapeXml(row.bankAccount ?? '')}</acctid>\n`;
      xml += `    </payeeaccountinfo>\n`;

      xml += `    <trntype>ibank.payment.pp3</trntype>\n`;
      xml += `    <trnuid>${crypto.randomUUID()}</trnuid>\n`;
      xml += `    <dtdue>${due}</dtdue>\n`;
      xml += `    <trnamt>${row.totalAmount.toFixed(2)}</trnamt>\n`;
      xml += `    <purpose>Promet robe i usluga - medjufazna potrosnja</purpose>\n`;
      xml += `    <purposecode>220</purposecode>\n`;
      xml += `    <curdef>RSD</curdef>\n`;
      xml += `  </pmtorder>\n`;
    }

    xml += `</pmtorderrq>`;

    return new NextResponse(xml, {
      headers: {
        'Content-Type': 'application/xml',
        'Content-Disposition': 'attachment; filename="payments.xml"',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
