import { NextResponse } from 'next/server';
import { buildKomercijalnaPaymentsTxt, encodeKomercijalnaPaymentsTxt } from '@/lib/exports/payments-komercijalna-txt';
import { getMonthlySummaries } from '@/lib/repositories/summaries';
import { getMonthlyExportFileName, normalizeExportLanguage } from '@/lib/utils/export-file-names';
import { parseMonth, parseYear } from '@/lib/utils/date';
import { normalizePeriod } from '@/lib/utils/period';

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

    const summaries = (await getMonthlySummaries({ year, month, city, period })).filter(
      (row) => Number.isFinite(row.qty) && row.qty > 0
    );
    const filtered = summaries.filter((row) => {
      if (!Number.isFinite(row.totalAmount) || row.totalAmount <= 0) return false;
      if (!row.bankAccount?.trim()) return false;
      if (!supplierIds.length) return true;
      return supplierIds.includes(row.supplierId);
    });

    const content = buildKomercijalnaPaymentsTxt(filtered, now, { year, month, period });
    const payload = encodeKomercijalnaPaymentsTxt(content);

    return new NextResponse(new Blob([payload], { type: 'text/plain; charset=us-ascii' }), {
      headers: {
        'Content-Type': 'text/plain; charset=us-ascii',
        'Content-Disposition': `attachment; filename="${getMonthlyExportFileName('payments-komercijalna', year, month, language, period)}"`,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
