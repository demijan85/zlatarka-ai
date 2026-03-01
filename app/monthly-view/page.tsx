'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { MonthlySummaryRow, Supplier } from '@/types/domain';
import {
  defaultVersionedConstants,
  getEffectiveConstantsForPeriod,
  sortVersions,
  type VersionedCalculationConstants,
} from '@/lib/constants/calculation';
import { useTranslation } from '@/lib/i18n/use-translation';
import { localeForLanguage } from '@/lib/i18n/locale';
import { yearMonthFrom } from '@/lib/utils/year-month';

type Period = 'first' | 'second' | 'all';

async function parseError(response: Response, fallback: string): Promise<Error> {
  try {
    const parsed = (await response.json()) as { error?: string };
    if (parsed.error) return new Error(parsed.error);
  } catch {
    // ignore parse error
  }
  return new Error(fallback);
}

async function fetchMonthly(year: number, month: number, city: string, period: Period): Promise<MonthlySummaryRow[]> {
  const params = new URLSearchParams({
    year: String(year),
    month: String(month),
    city,
    period,
  });

  const response = await fetch(`/api/summaries/monthly?${params.toString()}`);
  if (!response.ok) throw await parseError(response, 'Failed to fetch monthly summaries');
  return response.json();
}

async function fetchCities(): Promise<string[]> {
  const response = await fetch('/api/suppliers');
  if (!response.ok) return [];
  const data = (await response.json()) as Supplier[];
  return [...new Set(data.map((item) => item.city).filter(Boolean))] as string[];
}

async function fetchConstantVersions(): Promise<VersionedCalculationConstants[]> {
  const response = await fetch('/api/constants/versions');
  if (!response.ok) throw await parseError(response, 'Failed to fetch constants versions');
  return response.json();
}

export default function MonthlyViewPage() {
  const now = new Date();
  const { t, language } = useTranslation();
  const locale = localeForLanguage(language);

  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [city, setCity] = useState('');
  const [period, setPeriod] = useState<Period>('all');

  const { data: rows = [], isLoading, error } = useQuery({
    queryKey: ['monthly', year, month, city, period],
    queryFn: () => fetchMonthly(year, month, city, period),
  });

  const { data: cities = [] } = useQuery({ queryKey: ['supplier-cities'], queryFn: fetchCities });
  const { data: versionsData = [] } = useQuery({
    queryKey: ['constants-versions'],
    queryFn: fetchConstantVersions,
  });

  const totalAmount = rows.reduce((sum, item) => sum + item.totalAmount, 0);
  const totalQty = rows.reduce((sum, item) => sum + item.qty, 0);
  const alignCenter = { textAlign: 'center' as const };
  const alignRight = { textAlign: 'right' as const };

  const currentYearMonth = useMemo(() => yearMonthFrom(year, month), [year, month]);
  const orderedVersions = useMemo(
    () => sortVersions(versionsData.length ? versionsData : [defaultVersionedConstants]),
    [versionsData]
  );
  const effectiveVersion = useMemo(
    () => getEffectiveConstantsForPeriod(orderedVersions, currentYearMonth),
    [orderedVersions, currentYearMonth]
  );

  function openExport(path: string, fileName: string) {
    const params = new URLSearchParams({
      year: String(year),
      month: String(month),
      city,
      period,
    });

    fetch(`${path}?${params.toString()}`)
      .then(async (response) => {
        if (!response.ok) throw await parseError(response, 'Export failed');
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
      })
      .catch((exportError) => {
        alert((exportError as Error).message);
      });
  }

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div className="card" style={{ padding: 12, display: 'grid', gap: 10 }}>
        <h2 style={{ margin: 0 }}>{t('monthly.title')}</h2>
        <div className="muted" style={{ fontSize: 12 }}>
          {t('monthly.constantsUsed')}: <strong>{effectiveVersion.validFrom}</strong>
        </div>

        <div className="control-row">
          <select className="input" value={year} onChange={(e) => setYear(Number(e.target.value))}>
            {Array.from({ length: 6 }, (_, i) => now.getFullYear() - 2 + i).map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>

          <select className="input" value={month} onChange={(e) => setMonth(Number(e.target.value))}>
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <option key={m} value={m}>
                {new Date(year, m - 1, 1).toLocaleDateString(locale, { month: 'long' })}
              </option>
            ))}
          </select>

          <select className="input" value={period} onChange={(e) => setPeriod(e.target.value as Period)}>
            <option value="all">{t('monthly.fullMonth')}</option>
            <option value="first">{t('monthly.firstHalf')}</option>
            <option value="second">{t('monthly.secondHalf')}</option>
          </select>

          <select className="input" value={city} onChange={(e) => setCity(e.target.value)}>
            <option value="">{t('common.allCities')}</option>
            {cities.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          <button className="btn" onClick={() => openExport('/api/summaries/monthly/export', `monthly_summary_${year}_${month}.xlsx`)}>
            {t('monthly.exportSummary')}
          </button>
          <button className="btn" onClick={() => openExport('/api/summaries/monthly/receipts/pdf', `monthly_receipts_${year}_${month}.pdf`)}>
            {t('monthly.exportReceiptsPdf')}
          </button>
          <button className="btn" onClick={() => openExport('/api/summaries/monthly/payments', `payments_${year}_${month}.xml`)}>
            {t('monthly.exportPayments')}
          </button>
        </div>
      </div>

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th style={alignCenter}>{t('table.rb')}</th>
              <th>{t('table.lastName')}</th>
              <th>{t('table.firstName')}</th>
              <th style={alignRight}>{t('monthly.qty')}</th>
              <th style={alignCenter}>{t('monthly.mm')}</th>
              <th style={alignRight}>{t('monthly.priceMm')}</th>
              <th style={alignRight}>{t('monthly.priceQty')}</th>
              <th style={alignCenter}>{t('monthly.tax')}</th>
              <th style={alignRight}>{t('monthly.priceTax')}</th>
              <th style={alignCenter}>{t('monthly.stimulation')}</th>
              <th style={alignRight}>{t('monthly.totalAmount')}</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={11}>{t('common.loading')}</td>
              </tr>
            ) : error ? (
              <tr>
                <td colSpan={11} style={{ color: 'var(--danger)' }}>
                  {(error as Error).message}
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={11}>{t('monthly.noData')}</td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.supplierId}>
                  <td style={alignCenter}>{row.serialNum}</td>
                  <td>{row.lastName}</td>
                  <td>{row.firstName}</td>
                  <td style={alignRight}>{row.qty.toFixed(0)}</td>
                  <td style={alignCenter}>{row.fatPct.toFixed(2)}</td>
                  <td style={alignRight}>{row.pricePerFatPct.toFixed(2)}</td>
                  <td style={alignRight}>{row.pricePerQty.toFixed(2)}</td>
                  <td style={alignCenter}>{row.taxPercentage.toFixed(2)}</td>
                  <td style={alignRight}>{row.priceWithTax.toFixed(2)}</td>
                  <td style={alignCenter}>{row.stimulation.toFixed(2)}</td>
                  <td style={alignRight}>{row.totalAmount.toFixed(2)}</td>
                </tr>
              ))
            )}
            {rows.length > 0 ? (
              <tr style={{ background: '#f8fafc', fontWeight: 700 }}>
                <td colSpan={3}>{t('table.totals')}</td>
                <td style={alignRight}>{totalQty.toFixed(0)}</td>
                <td colSpan={6} />
                <td style={alignRight}>{totalAmount.toFixed(2)}</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
