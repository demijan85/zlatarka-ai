export type ExportLanguage = 'sr-Cyrl' | 'en';
export type MonthlyExportKind = 'summary' | 'receipts' | 'payments';
export type MonthlyExportPeriod = 'first' | 'second' | 'all';

export function normalizeExportLanguage(value: string | null | undefined): ExportLanguage {
  return value === 'en' ? 'en' : 'sr-Cyrl';
}

export function getMonthlyExportFileName(
  kind: MonthlyExportKind,
  year: number,
  month: number,
  language: ExportLanguage,
  period: MonthlyExportPeriod
): string {
  const monthPart = String(month).padStart(2, '0');
  const periodPart =
    period === 'first'
      ? language === 'en'
        ? '_first_half'
        : '_prvi_deo'
      : period === 'second'
        ? language === 'en'
          ? '_second_half'
          : '_drugi_deo'
        : '';

  if (language === 'en') {
    if (kind === 'summary') return `monthly_purchase_summary_${year}_${monthPart}${periodPart}.xlsx`;
    if (kind === 'receipts') return `monthly_receipts_${year}_${monthPart}${periodPart}.pdf`;
    return `payments_${year}_${monthPart}${periodPart}.xml`;
  }

  if (kind === 'summary') return `mesecni_pregled_otkupa_${year}_${monthPart}${periodPart}.xlsx`;
  if (kind === 'receipts') return `mesecne_priznanice_${year}_${monthPart}${periodPart}.pdf`;
  return `placanja_otkup_${year}_${monthPart}${periodPart}.xml`;
}
