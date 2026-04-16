'use client';

import { useEffect, useMemo, useState, type FocusEvent, type MouseEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { MonthlySummaryRow, Supplier } from '@/types/domain';
import {
  defaultVersionedConstants,
  getEffectiveConstantsForPeriod,
  sortVersions,
  type VersionedCalculationConstants,
} from '@/lib/constants/calculation';
import { TAX_ON_STIMULATION_VALID_FROM } from '@/lib/calculations/formulas';
import { useTranslation } from '@/lib/i18n/use-translation';
import { localeForLanguage } from '@/lib/i18n/locale';
import { formatIsoDateLabelForLocale } from '@/lib/utils/date';
import { getMonthlyExportFileName } from '@/lib/utils/export-file-names';
import {
  buildPriceWithTaxHeaderLabel,
  buildPriceWithTaxRateSuffix,
  calculateDisplayedTotalPricePerLiter,
  calculateDisplayedTotalPricePerLiterFromComponents,
} from '@/lib/utils/price-display';
import { periodStartDate } from '@/lib/utils/period';

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

  const response = await fetch(`/api/summaries/monthly?${params.toString()}`, { cache: 'no-store' });
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
  const queryClient = useQueryClient();

  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [city, setCity] = useState('');
  const [period, setPeriod] = useState<Period>('all');
  const [selectedSupplierIds, setSelectedSupplierIds] = useState<number[]>([]);
  const [showExportSelection, setShowExportSelection] = useState(false);
  const [actionError, setActionError] = useState('');
  const [overrideSupplierId, setOverrideSupplierId] = useState<number | null>(null);
  const [overrideDraft, setOverrideDraft] = useState({
    priceWithTax: '',
    stimulation: '',
  });

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

  const currentYearMonth = useMemo(() => `${year}-${String(month).padStart(2, '0')}`, [year, month]);
  const selectedMonthStart = useMemo(() => `${currentYearMonth}-01`, [currentYearMonth]);
  const firstHalfDate = useMemo(() => periodStartDate(year, month, 'first'), [year, month]);
  const secondHalfDate = useMemo(() => periodStartDate(year, month, 'second'), [year, month]);
  const overrideTarget = useMemo(
    () => visibleRows.find((row) => row.supplierId === overrideSupplierId) ?? null,
    [overrideSupplierId, visibleRows]
  );
  const orderedVersions = useMemo(
    () => sortVersions(versionsData.length ? versionsData : [defaultVersionedConstants]),
    [versionsData]
  );
  const constantsLabel = useMemo(() => {
    const firstHalfVersion = getEffectiveConstantsForPeriod(orderedVersions, firstHalfDate);
    const secondHalfVersion = getEffectiveConstantsForPeriod(orderedVersions, secondHalfDate);

    if (period === 'first') return firstHalfVersion.validFrom;
    if (period === 'second') return secondHalfVersion.validFrom;
    if (firstHalfVersion.validFrom === secondHalfVersion.validFrom) return firstHalfVersion.validFrom;
    return `${firstHalfVersion.validFrom} / ${secondHalfVersion.validFrom}`;
  }, [firstHalfDate, orderedVersions, period, secondHalfDate]);
  const pricingNote = selectedMonthStart < TAX_ON_STIMULATION_VALID_FROM ? t('monthly.legacyTaxNote') : '';
  const priceWithTaxLabel = useMemo(
    () => buildPriceWithTaxHeaderLabel(t('monthly.priceTax'), visibleRows.map((row) => row.taxPercentage)),
    [t, visibleRows]
  );
  const priceWithTaxSuffix = useMemo(
    () => buildPriceWithTaxRateSuffix(visibleRows.map((row) => row.taxPercentage)),
    [visibleRows]
  );

  const overrideMutation = useMutation({
    mutationFn: async (payload: { supplierId: number; priceWithTaxOverride: number | null; stimulationOverride: number | null }) => {
      const response = await fetch('/api/summaries/monthly/overrides', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          yearMonth: currentYearMonth,
          period,
          supplierId: payload.supplierId,
          priceWithTaxOverride: payload.priceWithTaxOverride,
          stimulationOverride: payload.stimulationOverride,
        }),
      });
      if (!response.ok) throw await parseError(response, 'Failed to save monthly overrides');
      return response.json();
    },
    onSuccess: async () => {
      setActionError('');
      await queryClient.refetchQueries({
        queryKey: ['monthly', year, month, city, period],
        exact: true,
      });
      setOverrideSupplierId(null);
      setOverrideDraft({ priceWithTax: '', stimulation: '' });
    },
    onError: (error) => {
      setActionError(error instanceof Error ? error.message : 'Failed to save monthly overrides');
    },
  });

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

  useEffect(() => {
    if (overrideSupplierId === null) return;
    if (visibleRows.some((row) => row.supplierId === overrideSupplierId)) return;
    setOverrideSupplierId(null);
    setOverrideDraft({ priceWithTax: '', stimulation: '' });
  }, [overrideSupplierId, visibleRows]);

  function openOverrideModal(row: MonthlySummaryRow) {
    setOverrideSupplierId(row.supplierId);
    setOverrideDraft({
      priceWithTax: row.priceWithTaxOverride !== null ? row.priceWithTaxOverride.toFixed(2) : '',
      stimulation: row.stimulationOverride !== null ? row.stimulationOverride.toFixed(2) : '',
    });
  }

  function normalizeOverride(value: string, calculatedValue: number): number | null {
    if (!value.trim()) return null;
    const normalized = value.replace(',', '.').trim();
    const parsed = Number(normalized);
    if (!Number.isFinite(parsed) || parsed < 0) return null;
    return Math.abs(parsed - calculatedValue) < 0.000001 ? null : parsed;
  }

  function buildOverrideTooltip(label: string, calculatedValue: number, effectiveValue: number): string {
    return `${label}: ${t('monthly.overrideCalculated')} ${calculatedValue.toFixed(2)} | ${t('monthly.overrideSet')} ${effectiveValue.toFixed(2)}`;
  }

  function displayedPricePerLiter(row: MonthlySummaryRow): number {
    return calculateDisplayedTotalPricePerLiter(row.totalAmount, row.qty);
  }

  function calculatedDisplayedPricePerLiter(row: MonthlySummaryRow): number {
    return calculateDisplayedTotalPricePerLiterFromComponents(
      row.calculatedPriceWithTax,
      row.calculatedStimulation,
      row.taxPercentage,
      selectedMonthStart
    );
  }

  function selectFieldContent(event: FocusEvent<HTMLInputElement> | MouseEvent<HTMLInputElement>) {
    event.currentTarget.select();
  }

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
      {actionError ? (
        <div className="card" style={{ padding: 12, color: 'var(--danger)' }}>
          {actionError}
        </div>
      ) : null}

      <div className="card" style={{ padding: 12, display: 'grid', gap: 10 }}>
        <h2 style={{ margin: 0 }}>{t('monthly.title')}</h2>
        <div className="muted" style={{ fontSize: 12 }}>
          {t('monthly.constantsUsed')}: <strong>{formatIsoDateLabelForLocale(constantsLabel, locale)}</strong>
        </div>
        {pricingNote ? (
          <div className="muted" style={{ fontSize: 11 }}>
            {pricingNote}
          </div>
        ) : null}

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
              <th style={alignRight}>{t('monthly.stimulation')}</th>
              <th style={alignRight}>
                <span style={{ display: 'inline-grid', lineHeight: 1.15, textAlign: 'right' }}>
                  <span>{t('monthly.priceTaxLine1')}</span>
                  <span>
                    {t('monthly.priceTaxLine2')}
                    {priceWithTaxSuffix ? ` ${priceWithTaxSuffix}` : ''}
                  </span>
                </span>
              </th>
              <th style={alignRight}>{t('monthly.totalAmount')}</th>
              <th style={alignCenter}>{t('monthly.overrideAction')}</th>
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
                  <td
                    style={alignRight}
                    className={row.priceWithTaxOverride !== null ? 'monthly-override-cell' : undefined}
                  >
                    {row.pricePerFatPct.toFixed(2)}
                    {row.priceWithTaxOverride !== null ? (
                      <div className="supplier-row-tooltip monthly-override-tooltip">
                        {buildOverrideTooltip(t('monthly.priceMm'), row.calculatedPricePerFatPct, row.pricePerFatPct)}
                      </div>
                    ) : null}
                  </td>
                  <td
                    style={alignRight}
                    className={row.priceWithTaxOverride !== null ? 'monthly-override-cell' : undefined}
                  >
                    {row.pricePerQty.toFixed(2)}
                    {row.priceWithTaxOverride !== null ? (
                      <div className="supplier-row-tooltip monthly-override-tooltip">
                        {buildOverrideTooltip(t('monthly.priceQty'), row.calculatedPricePerQty, row.pricePerQty)}
                      </div>
                    ) : null}
                  </td>
                  <td
                    style={alignRight}
                    className={row.stimulationOverride !== null ? 'monthly-override-cell' : undefined}
                  >
                    {row.stimulation.toFixed(2)}
                    {row.stimulationOverride !== null ? (
                      <div className="supplier-row-tooltip monthly-override-tooltip">
                        {buildOverrideTooltip(t('monthly.stimulation'), row.calculatedStimulation, row.stimulation)}
                      </div>
                    ) : null}
                  </td>
                  <td
                    style={alignRight}
                    className={row.priceWithTaxOverride !== null || row.stimulationOverride !== null ? 'monthly-override-cell' : undefined}
                  >
                    {displayedPricePerLiter(row).toFixed(2)}
                    {row.priceWithTaxOverride !== null || row.stimulationOverride !== null ? (
                      <div className="supplier-row-tooltip monthly-override-tooltip">
                        {buildOverrideTooltip(priceWithTaxLabel, calculatedDisplayedPricePerLiter(row), displayedPricePerLiter(row))}
                      </div>
                    ) : null}
                  </td>
                  <td style={alignRight}>{row.totalAmount.toFixed(2)}</td>
                  <td style={alignCenter}>
                    <button className="btn" type="button" onClick={() => openOverrideModal(row)}>
                      {t('common.edit')}
                    </button>
                  </td>
                </tr>
              ))
            )}
            {visibleRows.length > 0 ? (
              <tr style={{ background: '#f8fafc', fontWeight: 700 }}>
                <td colSpan={3}>{t('table.totals')}</td>
                <td style={alignRight}>{totalQty.toFixed(0)}</td>
                <td colSpan={5} />
                <td style={alignRight}>{totalAmount.toFixed(2)}</td>
                <td />
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {overrideTarget ? (
        <div className="modal-backdrop" onClick={() => !overrideMutation.isPending && setOverrideSupplierId(null)}>
          <div className="modal-panel" style={{ width: 'min(520px, 100%)' }} onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <div style={{ display: 'grid', gap: 4 }}>
                <h3 style={{ margin: 0 }}>{t('monthly.overrideTitle')}</h3>
                <div className="muted">{`${overrideTarget.lastName} ${overrideTarget.firstName}`}</div>
              </div>
              <button
                className="btn"
                type="button"
                onClick={() => setOverrideSupplierId(null)}
                disabled={overrideMutation.isPending}
              >
                {t('common.close')}
              </button>
            </div>

            <div style={{ display: 'grid', gap: 12 }}>
              <div className="muted" style={{ fontSize: 12 }}>
                {t('monthly.overrideHint')}
              </div>

              <div className="supplier-form-grid supplier-form-grid-2">
                <label className="module-field">
                  <span className="field-label">{t('monthly.milkPriceTax')}</span>
                  <input
                    className="input"
                    type="text"
                    inputMode="decimal"
                    value={overrideDraft.priceWithTax}
                    placeholder={overrideTarget.calculatedPriceWithTax.toFixed(2)}
                    onChange={(event) => setOverrideDraft((current) => ({ ...current, priceWithTax: event.target.value }))}
                    onFocus={selectFieldContent}
                    onClick={selectFieldContent}
                  />
                  <span className="muted" style={{ fontSize: 12 }}>
                    {`${t('monthly.overrideCalculated')}: ${overrideTarget.calculatedPriceWithTax.toFixed(2)}`}
                  </span>
                </label>

                <label className="module-field">
                  <span className="field-label">{t('monthly.stimulation')}</span>
                  <input
                    className="input"
                    type="text"
                    inputMode="decimal"
                    value={overrideDraft.stimulation}
                    placeholder={overrideTarget.calculatedStimulation.toFixed(2)}
                    onChange={(event) => setOverrideDraft((current) => ({ ...current, stimulation: event.target.value }))}
                    onFocus={selectFieldContent}
                    onClick={selectFieldContent}
                  />
                  <span className="muted" style={{ fontSize: 12 }}>
                    {`${t('monthly.overrideCalculated')}: ${overrideTarget.calculatedStimulation.toFixed(2)}`}
                  </span>
                </label>
              </div>

              <div className="control-row" style={{ justifyContent: 'flex-end' }}>
                <button
                  className="btn"
                  type="button"
                  onClick={() => setOverrideSupplierId(null)}
                  disabled={overrideMutation.isPending}
                >
                  {t('common.cancel')}
                </button>
                <button
                  className="btn primary"
                  type="button"
                  onClick={() =>
                    overrideMutation.mutate({
                      supplierId: overrideTarget.supplierId,
                      priceWithTaxOverride: normalizeOverride(overrideDraft.priceWithTax, overrideTarget.calculatedPriceWithTax),
                      stimulationOverride: normalizeOverride(overrideDraft.stimulation, overrideTarget.calculatedStimulation),
                    })
                  }
                  disabled={overrideMutation.isPending}
                >
                  {overrideMutation.isPending ? t('common.saving') : t('monthly.overrideSave')}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
