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
    const tableStartColumn = 1;
    const tableEndColumn = 7;
    const thinBorder: Partial<ExcelJS.Borders> = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' },
    };
    const mediumBorder: Partial<ExcelJS.Borders> = {
      top: { style: 'medium' },
      left: { style: 'medium' },
      bottom: { style: 'medium' },
      right: { style: 'medium' },
    };

    function applyRowBorder(rowNumber: number, border: Partial<ExcelJS.Borders>) {
      for (let column = tableStartColumn; column <= tableEndColumn; column += 1) {
        sheet.getRow(rowNumber).getCell(column).border = border;
      }
    }
    sheet.pageSetup = {
      paperSize: 9, // A4
      orientation: 'portrait',
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
    };

    const title = `KVARTALNI PREGLED - Q${quarter} ${year}`;
    const titleRow = sheet.addRow([title]);
    sheet.mergeCells('A1:G1');
    titleRow.getCell(1).font = { bold: true, size: 14 };
    titleRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
    titleRow.height = 24;

    sheet.addRow([]);

    const headerRow = sheet.addRow(['RB', 'Prezime', 'Ime', 'Kolicina', 'Broj krava', 'Premija/L', 'Ukupno']);
    headerRow.font = { bold: true };

    for (const row of summaries) {
      const dataRow = sheet.addRow([row.serialNum, row.lastName, row.firstName, row.qty, row.cows, row.premiumPerL, row.totalPremium]);
      const totalPremiumCell = dataRow.getCell(7);
      totalPremiumCell.font = { bold: true };
      totalPremiumCell.numFmt = '0';
    }

    const totalQty = summaries.reduce((sum, item) => sum + item.qty, 0);
    const totalPremium = summaries.reduce((sum, item) => sum + item.totalPremium, 0);
    const footerRow = sheet.addRow(['', '', 'TOTAL', totalQty, '', '', totalPremium]);
    footerRow.font = { bold: true };
    footerRow.getCell(7).numFmt = '0';

    applyRowBorder(headerRow.number, mediumBorder);
    for (let rowNumber = headerRow.number + 1; rowNumber < footerRow.number; rowNumber += 1) {
      applyRowBorder(rowNumber, thinBorder);
    }
    applyRowBorder(footerRow.number, mediumBorder);

    sheet.columns = [
      { key: 'rb', width: 6 },
      { key: 'lastName', width: 16 },
      { key: 'firstName', width: 16 },
      { key: 'qty', width: 11 },
      { key: 'cows', width: 10 },
      { key: 'premiumPerL', width: 10 },
      { key: 'totalPremium', width: 12 },
    ];

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
