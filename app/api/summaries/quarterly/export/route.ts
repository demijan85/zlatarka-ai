import { NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import { getEffectiveCalculationConstantsForYearMonth } from '@/lib/repositories/calculation-constants';
import { getQuarterlySummaries } from '@/lib/repositories/summaries';
import { parseQuarter, parseYear } from '@/lib/utils/date';
import { yearMonthFrom } from '@/lib/utils/year-month';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const now = new Date();
    const currentQuarter = Math.floor(now.getMonth() / 3) + 1;
    const year = parseYear(searchParams.get('year'), now.getFullYear());
    const quarter = parseQuarter(searchParams.get('quarter'), currentQuarter);
    const startMonth = (quarter - 1) * 3 + 1;

    const constants = await getEffectiveCalculationConstantsForYearMonth(yearMonthFrom(year, startMonth));
    const summaries = await getQuarterlySummaries({ year, quarter, constants });

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Quarterly Summary');

    sheet.addRow(['RB', 'Prezime', 'Ime', 'Kolicina', 'Broj krava', 'Premija/L', 'Ukupno']);

    for (const row of summaries) {
      sheet.addRow([row.serialNum, row.lastName, row.firstName, row.qty, row.cows, row.premiumPerL, row.totalPremium]);
    }

    const totalQty = summaries.reduce((sum, item) => sum + item.qty, 0);
    const totalPremium = summaries.reduce((sum, item) => sum + item.totalPremium, 0);
    sheet.addRow(['', '', 'TOTAL', totalQty, '', '', totalPremium]);

    const buffer = await workbook.xlsx.writeBuffer();
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="quarterly_summary_${year}_Q${quarter}.xlsx"`,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
