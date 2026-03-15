'use client';

import { useEffect, useMemo, useState } from 'react';
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
import { getMonthlyExportFileName } from '@/lib/utils/export-file-names';
import { yearMonthFrom } from '@/lib/utils/year-month';

type Period = 'first' | 'second' | 'all';
const EMPTY_ROWS: MonthlySummaryRow[] = [];
const EMPTY_CITIES: string[] = [];
const EMPTY_VERSIONS: VersionedCalculationConstants[] = [];

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
  const [selectedSupplierIds, setSelectedSupplierIds] = useState<number[]>([]);
  const [showExportSelection, setShowExportSelection] = useState(false);

  const { data: rows = EMPTY_ROWS, isLoading, error } = useQuery({
    queryKey: ['monthly', year, month, city, period],
    queryFn: () => fetchMonthly(year, month, city, period),
  });

  const { data: cities = EMPTY_CITIES } = useQuery({ queryKey: ['supplier-cities'], queryFn: fetchCities });
  const { data: versionsData = EMPTY_VERSIONS } = useQuery({
    queryKey: ['constants-versions'],
    queryFn: fetchConstantVersions,
  });

  const visibleRows = useMemo(
    () => rows.filter((row) => Number.isFinite(row.qty) && row.qty > 0),
    [rows]
  );
  const totalAmount = visibleRows.reduce((sum, item) => sum + item.totalAmount, 0);
  const totalQty = visibleRows.reduce((sum, item) => sum + item.qty, 0);
  const alignCenter = { textAlign: 'center' as const };
  const alignRight = { textAlign: 'right' as const };
  const exportableRows = useMemo(
    () =>
      visibleRows.filter(
        (row) => Number.isFinite(row.totalAmount) && row.totalAmount > 0 && Boolean(row.bankAccount?.trim())
      ),
    [visibleRows]
  );
  const allExportableSelected =
    exportableRows.length > 0 && exportableRows.every((row) => selectedSupplierIds.includes(row.supplierId));

  const currentYearMonth = useMemo(() => yearMonthFrom(year, month), [year, month]);
  const orderedVersions = useMemo(
    () => sortVersions(versionsData.length ? versionsData : [defaultVersionedConstants]),
    [versionsData]
  );
  const effectiveVersion = useMemo(
    () => getEffectiveConstantsForPeriod(orderedVersions, currentYearMonth),
    [orderedVersions, currentYearMonth]
  );

  useEffect(() => {
    setSelectedSupplierIds((current) => {
      const exportableIds = exportableRows.map((row) => row.supplierId);
      const exportableSet = new Set(exportableIds);
      const preserved = current.filter((id) => exportableSet.has(id));
      const next = preserved.length ? preserved : exportableIds;

      if (current.length === next.length && current.every((id, index) => id === next[index])) {
        return current;
      }

      return next;
    });
  }, [exportableRows]);

  function openExport(path: string, fileName: string) {
    const exportIds = exportableRows
      .filter((row) => selectedSupplierIds.includes(row.supplierId))
      .map((row) => row.supplierId);

    if (path.includes('/payments') && exportIds.length === 0) {
      alert(t('monthly.noSelectedPayments'));
      return;
    }

    const params = new URLSearchParams({
      year: String(year),
      month: String(month),
      city,
      period,
      lang: language,
    });
    if (path.includes('/payments')) {
      exportIds.forEach((id) => params.append('supplierId', String(id)));
    }

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

          <button
            className="btn"
            onClick={() =>
              openExport('/api/summaries/monthly/export', getMonthlyExportFileName('summary', year, month, language, period))
            }
          >
            {t('monthly.exportSummary')}
          </button>
          <button
            className="btn"
            onClick={() =>
              openExport(
                '/api/summaries/monthly/receipts/pdf',
                getMonthlyExportFileName('receipts', year, month, language, period)
              )
            }
          >
            {t('monthly.exportReceiptsPdf')}
          </button>
          <button
            className="btn"
            onClick={() =>
              openExport('/api/summaries/monthly/payments', getMonthlyExportFileName('payments', year, month, language, period))
            }
          >
            {t('monthly.exportPayments')}
          </button>
        </div>

        <div style={{ display: 'grid', gap: 8 }}>
          <button className="btn" type="button" onClick={() => setShowExportSelection((value) => !value)}>
            {showExportSelection ? t('monthly.hideExportSelection') : t('monthly.showExportSelection')}
          </button>

          {showExportSelection ? (
            <div
              style={{
                border: '1px solid var(--border)',
                borderRadius: 10,
                padding: 10,
                display: 'grid',
                gap: 8,
                maxHeight: 260,
                overflow: 'auto',
              }}
            >
              <div className="muted" style={{ fontSize: 12 }}>
                {t('monthly.exportSelectionHint')}
              </div>

              <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontWeight: 600 }}>
                <input
                  type="checkbox"
                  checked={allExportableSelected}
                  onChange={(e) =>
                    setSelectedSupplierIds(e.target.checked ? exportableRows.map((row) => row.supplierId) : [])
                  }
                />
                <span>{t('monthly.selectAllExportable')}</span>
              </label>

              {exportableRows.length === 0 ? (
                <div className="muted">{t('monthly.noExportableSuppliers')}</div>
              ) : (
                exportableRows.map((row) => {
                  const checked = selectedSupplierIds.includes(row.supplierId);
                  return (
                    <label
                      key={row.supplierId}
                      style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}
                    >
                      <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) =>
                            setSelectedSupplierIds((current) =>
                              e.target.checked
                                ? [...current, row.supplierId]
                                : current.filter((id) => id !== row.supplierId)
                            )
                          }
                        />
                        <span>
                          {row.lastName} {row.firstName}
                        </span>
                      </span>
                      <strong>{row.totalAmount.toFixed(2)}</strong>
                    </label>
                  );
                })
              )}
            </div>
          ) : null}
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
            ) : visibleRows.length === 0 ? (
              <tr>
                <td colSpan={11}>{t('monthly.noData')}</td>
              </tr>
            ) : (
              visibleRows.map((row) => (
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
            {visibleRows.length > 0 ? (
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
