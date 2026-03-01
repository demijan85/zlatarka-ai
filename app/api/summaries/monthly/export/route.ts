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
    const worksheet = workbook.addWorksheet('Monthly Summary');

    worksheet.addRow([
      'RB',
      'Prezime',
      'Ime',
      'Kolicina (L)',
      'mm',
      'Cena mm',
      'Cena kolicina',
      'PDV %',
      'Cena sa PDV',
      'Stimulacija',
      'Ukupno',
    ]);

    for (const row of summaries) {
      worksheet.addRow([
        row.serialNum,
        row.lastName,
        row.firstName,
        row.qty,
        row.fatPct,
        row.pricePerFatPct,
        row.pricePerQty,
        row.taxPercentage,
        row.priceWithTax,
        row.stimulation,
        row.totalAmount,
      ]);
    }

    const totalQty = summaries.reduce((sum, item) => sum + item.qty, 0);
    const totalAmount = summaries.reduce((sum, item) => sum + item.totalAmount, 0);
    worksheet.addRow(['', '', 'TOTAL', totalQty, '', '', '', '', '', '', totalAmount]);

    worksheet.columns = [
      { width: 6 },
      { width: 20 },
      { width: 20 },
      { width: 14 },
      { width: 10 },
      { width: 10 },
      { width: 14 },
      { width: 8 },
      { width: 14 },
      { width: 12 },
      { width: 14 },
    ];

    const buffer = await workbook.xlsx.writeBuffer();
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="monthly_summary_${year}_${month}.xlsx"`,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
