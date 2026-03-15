import { NextResponse } from 'next/server';
import { buildPaymentsXml, encodePaymentsXml } from '@/lib/exports/payments-xml';
import { getEffectiveCalculationConstantsForYearMonth } from '@/lib/repositories/calculation-constants';
import { getMonthlySummaries } from '@/lib/repositories/summaries';
import { getMonthlyExportFileName, normalizeExportLanguage } from '@/lib/utils/export-file-names';
import { parseMonth, parseYear } from '@/lib/utils/date';
import { normalizePeriod } from '@/lib/utils/period';
import { yearMonthFrom } from '@/lib/utils/year-month';

function parseSupplierIds(searchParams: URLSearchParams): number[] {
  const rawValues = [...searchParams.getAll('supplierId')];
  const csv = searchParams.get('supplierIds');
  if (csv) rawValues.push(...csv.split(','));

  return [...new Set(rawValues.map((value) => Number(value)).filter((value) => Number.isInteger(value) && value > 0))];
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
    const supplierIds = parseSupplierIds(searchParams);

    const constants = await getEffectiveCalculationConstantsForYearMonth(yearMonthFrom(year, month));
    const summaries = (await getMonthlySummaries({ year, month, city, period, constants })).filter(
      (row) => Number.isFinite(row.qty) && row.qty > 0
    );
    const filtered = summaries.filter((row) => {
      if (!Number.isFinite(row.totalAmount) || row.totalAmount <= 0) return false;
      if (!row.bankAccount?.trim()) return false;
      if (!supplierIds.length) return true;
      return supplierIds.includes(row.supplierId);
    });

    const xml = buildPaymentsXml(filtered, new Date());
    const payload = encodePaymentsXml(xml);

    return new NextResponse(new Blob([payload], { type: 'application/xml; charset=utf-16le' }), {
      headers: {
        'Content-Type': 'application/xml; charset=utf-16le',
        'Content-Disposition': `attachment; filename="${getMonthlyExportFileName('payments', year, month, language, period)}"`,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
