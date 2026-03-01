import { NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import { getEffectiveCalculationConstantsForYearMonth } from '@/lib/repositories/calculation-constants';
import { getMonthlySummaries } from '@/lib/repositories/summaries';
import { parseMonth, parseYear } from '@/lib/utils/date';
import { normalizePeriod } from '@/lib/utils/period';
import { yearMonthFrom } from '@/lib/utils/year-month';

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

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Receipts');

    sheet.addRow(['Receipts', `${month}/${year}`]);
    sheet.addRow([]);
    sheet.addRow(['Producer', 'JMBG', 'Bank Account', 'Qty', 'Avg mm', 'Total Amount']);

    for (const row of summaries) {
      sheet.addRow([
        `${row.lastName} ${row.firstName}`,
        row.jmbg ?? '',
        row.bankAccount ?? '',
        row.qty,
        row.fatPct,
        row.totalAmount,
      ]);
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="monthly_receipts_${year}_${month}.xlsx"`,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
