import { NextResponse } from 'next/server';
import { buildKomercijalnaPaymentsTxt, encodeKomercijalnaPaymentsTxt } from '@/lib/exports/payments-komercijalna-txt';
import { getQuarterlySummarySnapshot } from '@/lib/repositories/summaries';
import { parseQuarter, parseYear } from '@/lib/utils/date';
import { getQuarterlyPaymentExportFileName, normalizeExportLanguage } from '@/lib/utils/export-file-names';
import { getQuarterlyPremiumPurpose } from '@/lib/utils/payment-purpose';

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
    const currentQuarter = Math.floor(now.getMonth() / 3) + 1;
    const year = parseYear(searchParams.get('year'), now.getFullYear());
    const quarter = parseQuarter(searchParams.get('quarter'), currentQuarter);
    const language = normalizeExportLanguage(searchParams.get('lang'));
    const supplierIds = parseSupplierIds(searchParams);

    const snapshot = await getQuarterlySummarySnapshot({ year, quarter });
    const filtered = snapshot.rows.filter((row) => {
      if (!Number.isFinite(row.totalPremium) || row.totalPremium <= 0) return false;
      if (!row.bankAccount?.trim()) return false;
      if (!supplierIds.length) return true;
      return supplierIds.includes(row.supplierId);
    });

    const content = buildKomercijalnaPaymentsTxt(
      filtered.map((row) => ({ ...row, totalAmount: row.totalPremium })),
      now,
      {
        purpose: getQuarterlyPremiumPurpose(quarter, year, language),
      }
    );
    const payload = encodeKomercijalnaPaymentsTxt(content);

    return new NextResponse(new Blob([payload], { type: 'text/plain; charset=us-ascii' }), {
      headers: {
        'Content-Type': 'text/plain; charset=us-ascii',
        'Content-Disposition': `attachment; filename="${getQuarterlyPaymentExportFileName('payments-komercijalna', year, quarter, language)}"`,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
