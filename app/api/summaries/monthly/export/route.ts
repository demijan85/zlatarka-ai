import { NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import { getMonthlySummaries } from '@/lib/repositories/summaries';
import { getMonthlyExportFileName, normalizeExportLanguage } from '@/lib/utils/export-file-names';
import { parseMonth, parseYear } from '@/lib/utils/date';
import { normalizePeriod } from '@/lib/utils/period';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const now = new Date();
    const year = parseYear(searchParams.get('year'), now.getFullYear());
    const month = parseMonth(searchParams.get('month'), now.getMonth() + 1);
    const period = normalizePeriod(searchParams.get('period'));
    const city = searchParams.get('city') || undefined;
    const language = normalizeExportLanguage(searchParams.get('lang'));

    const summaries = (await getMonthlySummaries({ year, month, city, period })).filter(
      (row) => Number.isFinite(row.qty) && row.qty > 0
    );

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Monthly Summary');
    worksheet.pageSetup = {
      paperSize: 9, // A4
      orientation: 'landscape',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: {
        left: 0.2,
        right: 0.2,
        top: 0.3,
        bottom: 0.3,
        header: 0.1,
        footer: 0.1,
      },
      horizontalCentered: true,
      verticalCentered: false,
      printTitlesRow: '1:1',
    };
    worksheet.views = [{ state: 'frozen', ySplit: 1 }];

    const headerRow = worksheet.addRow([
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
    headerRow.font = { bold: true };

    for (const row of summaries) {
      const dataRow = worksheet.addRow([
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
      dataRow.getCell(4).numFmt = '0';
      dataRow.getCell(5).numFmt = '0.00';
      dataRow.getCell(6).numFmt = '0.00';
      dataRow.getCell(7).numFmt = '0.00';
      dataRow.getCell(8).numFmt = '0.00';
      dataRow.getCell(9).numFmt = '0.00';
      dataRow.getCell(10).numFmt = '0.00';
      dataRow.getCell(11).numFmt = '0.00';
    }

    const totalQty = summaries.reduce((sum, item) => sum + item.qty, 0);
    const totalAmount = summaries.reduce((sum, item) => sum + item.totalAmount, 0);
    const totalRow = worksheet.addRow(['', '', 'TOTAL', totalQty, '', '', '', '', '', '', totalAmount]);
    totalRow.font = { bold: true };
    totalRow.getCell(4).numFmt = '0';
    totalRow.getCell(11).numFmt = '0.00';

    worksheet.columns = [
      { width: 5 },
      { width: 16 },
      { width: 16 },
      { width: 12 },
      { width: 8 },
      { width: 9 },
      { width: 11 },
      { width: 8 },
      { width: 11 },
      { width: 10 },
      { width: 12 },
    ];

    const buffer = await workbook.xlsx.writeBuffer();
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${getMonthlyExportFileName('summary', year, month, language, period)}"`,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
