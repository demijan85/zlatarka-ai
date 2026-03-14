'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import type { Supplier, SupplierHistory } from '@/types/domain';
import { localeForLanguage } from '@/lib/i18n/locale';
import { useTranslation } from '@/lib/i18n/use-translation';

async function parseError(response: Response, fallback: string): Promise<Error> {
  try {
    const parsed = (await response.json()) as { error?: string };
    if (parsed.error) return new Error(parsed.error);
  } catch {
    // ignore parse errors
  }

  return new Error(fallback);
}

async function fetchSuppliers(): Promise<Supplier[]> {
  const response = await fetch('/api/suppliers');
  if (!response.ok) throw await parseError(response, 'Failed to fetch suppliers');
  return response.json();
}

async function fetchSupplierHistory(supplierId: number, year: number): Promise<SupplierHistory> {
  const params = new URLSearchParams({
    supplierId: String(supplierId),
    year: String(year),
  });

  const response = await fetch(`/api/suppliers/history?${params.toString()}`);
  if (!response.ok) throw await parseError(response, 'Failed to fetch supplier history');
  return response.json();
}

export default function SupplierHistoryPage() {
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const searchParams = useSearchParams();
  const { t, language } = useTranslation();
  const locale = localeForLanguage(language);
  const requestedSupplierId = useMemo(() => {
    const raw = searchParams.get('supplierId');
    const parsed = Number(raw);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  }, [searchParams]);
  const [year, setYear] = useState(now.getFullYear());
  const [supplierId, setSupplierId] = useState<number | null>(requestedSupplierId);
  const [supplierSearch, setSupplierSearch] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);

  const suppliersQuery = useQuery({
    queryKey: ['suppliers-history-list'],
    queryFn: fetchSuppliers,
  });

  const suppliers = useMemo(() => suppliersQuery.data ?? [], [suppliersQuery.data]);

  const filteredSuppliers = useMemo(() => {
    const term = supplierSearch.trim().toLocaleLowerCase();
    if (!term) return suppliers;

    return suppliers.filter((supplier) =>
      `${supplier.last_name} ${supplier.first_name} ${supplier.city ?? ''}`.toLocaleLowerCase().includes(term)
    );
  }, [supplierSearch, suppliers]);

  const supplierOptions = useMemo(() => {
    if (supplierId === null) return filteredSuppliers;

    const selectedSupplier = suppliers.find((supplier) => supplier.id === supplierId);
    if (!selectedSupplier) return filteredSuppliers;
    if (filteredSuppliers.some((supplier) => supplier.id === supplierId)) return filteredSuppliers;

    return [selectedSupplier, ...filteredSuppliers];
  }, [filteredSuppliers, supplierId, suppliers]);

  useEffect(() => {
    if (!suppliers.length) return;
    if (supplierId !== null && suppliers.some((supplier) => supplier.id === supplierId)) return;

    if (requestedSupplierId !== null && suppliers.some((supplier) => supplier.id === requestedSupplierId)) {
      setSupplierId(requestedSupplierId);
      return;
    }

    setSupplierId(suppliers[0].id);
  }, [requestedSupplierId, supplierId, suppliers]);

  const historyQuery = useQuery({
    queryKey: ['supplier-history', supplierId, year],
    queryFn: () => fetchSupplierHistory(supplierId as number, year),
    enabled: supplierId !== null,
  });

  useEffect(() => {
    if (!historyQuery.data) return;
    const preferredMonth =
      [...historyQuery.data.months].reverse().find((item) => item.qty > 0 || item.measurementCount > 0)?.month ??
      currentMonth;
    setSelectedMonth(preferredMonth);
  }, [currentMonth, historyQuery.data]);

  const history = historyQuery.data ?? null;

  const selectedMonthSummary = useMemo(
    () => history?.months.find((item) => item.month === selectedMonth) ?? null,
    [history, selectedMonth]
  );
  const selectedMonthEntries = useMemo(
    () => (history?.dailyEntries ?? []).filter((item) => item.month === selectedMonth),
    [history, selectedMonth]
  );

  function formatNumber(value: number, digits = 0): string {
    return value.toLocaleString(locale, {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    });
  }

  function formatDate(value: string | null): string {
    if (!value) return '-';
    return new Date(`${value}T00:00:00`).toLocaleDateString(locale);
  }

  const isLoading = suppliersQuery.isLoading || historyQuery.isLoading;
  const error = suppliersQuery.error || historyQuery.error;

  return (
    <div className="history-layout">
      <div className="card" style={{ padding: 12, display: 'grid', gap: 10 }}>
        <h2 style={{ margin: 0 }}>{t('producerHistory.title')}</h2>
        <div className="muted" style={{ fontSize: 12 }}>
          {t('producerHistory.subtitle')}
        </div>

        <div className="control-row">
          <input
            className="input"
            value={supplierSearch}
            onChange={(event) => setSupplierSearch(event.target.value)}
            placeholder={t('producerHistory.searchSupplier')}
          />

          <select
            className="input"
            value={supplierId ?? ''}
            onChange={(event) => setSupplierId(event.target.value ? Number(event.target.value) : null)}
          >
            <option value="">{t('producerHistory.selectSupplier')}</option>
            {supplierOptions.map((supplier) => (
              <option key={supplier.id} value={supplier.id}>
                {`${supplier.last_name} ${supplier.first_name}${supplier.city ? ` - ${supplier.city}` : ''}`}
              </option>
            ))}
          </select>

          <select className="input" value={year} onChange={(event) => setYear(Number(event.target.value))}>
            {Array.from({ length: 8 }, (_, index) => now.getFullYear() - 4 + index).map((itemYear) => (
              <option key={itemYear} value={itemYear}>
                {itemYear}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error ? (
        <div className="card" style={{ padding: 16, color: 'var(--danger)' }}>
          {(error as Error).message}
        </div>
      ) : null}

      {isLoading && !history ? (
        <div className="card" style={{ padding: 16 }}>
          {t('common.loading')}
        </div>
      ) : null}

      {!supplierId && !isLoading ? (
        <div className="card" style={{ padding: 16 }}>
          {t('producerHistory.noSupplierSelected')}
        </div>
      ) : null}

      {history ? (
        <>
          <div className="history-hero">
            <div className="card" style={{ padding: 16, display: 'grid', gap: 14 }}>
              <div>
                <div className="muted" style={{ fontSize: 12 }}>
                  {t('producerHistory.producer')}
                </div>
                <div style={{ fontSize: 28, fontWeight: 700 }}>
                  {`${history.supplier.first_name} ${history.supplier.last_name}`}
                </div>
              </div>

              <div className="history-meta">
                <div>
                  <div className="muted" style={{ fontSize: 12 }}>
                    {t('producerHistory.location')}
                  </div>
                  <div>{[history.supplier.street, history.supplier.city].filter(Boolean).join(', ') || '-'}</div>
                </div>
                <div>
                  <div className="muted" style={{ fontSize: 12 }}>
                    {t('producerHistory.cows')}
                  </div>
                  <div>{history.supplier.number_of_cows ?? '-'}</div>
                </div>
                <div>
                  <div className="muted" style={{ fontSize: 12 }}>
                    JMBG
                  </div>
                  <div>{history.supplier.jmbg || '-'}</div>
                </div>
                <div>
                  <div className="muted" style={{ fontSize: 12 }}>
                    {t('producerHistory.lastDelivery')}
                  </div>
                  <div>{formatDate(history.summary.lastDeliveryDate)}</div>
                </div>
              </div>
            </div>

            <div className="card" style={{ padding: 16, display: 'grid', gap: 12 }}>
              <div>
                <div className="muted" style={{ fontSize: 12 }}>
                  {t('producerHistory.yearlySummary')}
                </div>
                <div style={{ fontSize: 22, fontWeight: 700 }}>{history.year}</div>
              </div>

              <div className="history-summary-list">
                <div>
                  <span>{t('producerHistory.annualQty')}</span>
                  <strong>{`${formatNumber(history.summary.totalQty, 0)} L`}</strong>
                </div>
                <div>
                  <span>{t('producerHistory.annualAmount')}</span>
                  <strong>{`${formatNumber(history.summary.totalAmount, 0)} RSD`}</strong>
                </div>
                <div>
                  <span>{t('producerHistory.annualAvgFat')}</span>
                  <strong>{`${formatNumber(history.summary.avgFatPct, 2)} %`}</strong>
                </div>
                <div>
                  <span>{t('producerHistory.annualStimulation')}</span>
                  <strong>{`${formatNumber(history.summary.totalStimulationAmount, 0)} RSD`}</strong>
                </div>
              </div>
            </div>
          </div>

          <div className="history-kpis">
            <div className="card" style={{ padding: 14 }}>
              <div className="muted">{t('producerHistory.annualQty')}</div>
              <div style={{ fontSize: 24, fontWeight: 700 }}>{`${formatNumber(history.summary.totalQty, 0)} L`}</div>
            </div>
            <div className="card" style={{ padding: 14 }}>
              <div className="muted">{t('producerHistory.annualAmount')}</div>
              <div style={{ fontSize: 24, fontWeight: 700 }}>{`${formatNumber(history.summary.totalAmount, 0)} RSD`}</div>
            </div>
            <div className="card" style={{ padding: 14 }}>
              <div className="muted">{t('producerHistory.activeMonths')}</div>
              <div style={{ fontSize: 24, fontWeight: 700 }}>{formatNumber(history.summary.activeMonths, 0)}</div>
            </div>
            <div className="card" style={{ padding: 14 }}>
              <div className="muted">{t('producerHistory.activeDays')}</div>
              <div style={{ fontSize: 24, fontWeight: 700 }}>{formatNumber(history.summary.activeDays, 0)}</div>
            </div>
            <div className="card" style={{ padding: 14 }}>
              <div className="muted">{t('producerHistory.measurements')}</div>
              <div style={{ fontSize: 24, fontWeight: 700 }}>{formatNumber(history.summary.measurementCount, 0)}</div>
            </div>
            <div className="card" style={{ padding: 14 }}>
              <div className="muted">{t('producerHistory.annualAvgFat')}</div>
              <div style={{ fontSize: 24, fontWeight: 700 }}>{`${formatNumber(history.summary.avgFatPct, 2)} %`}</div>
            </div>
          </div>

          <div className="card" style={{ padding: 14, display: 'grid', gap: 12 }}>
            <div>
              <h3 style={{ margin: 0 }}>{t('producerHistory.monthlyBreakdown')}</h3>
              <div className="muted" style={{ fontSize: 12 }}>
                {history.year}
              </div>
            </div>

            <div className="history-month-grid">
              {history.months.map((month) => {
                const active = month.month === selectedMonth;
                const monthLabel = new Date(history.year, month.month - 1, 1).toLocaleDateString(locale, { month: 'long' });

                return (
                  <button
                    key={month.month}
                    type="button"
                    className={`history-month-card${active ? ' active' : ''}`}
                    onClick={() => setSelectedMonth(month.month)}
                  >
                    <div className="history-month-card-head">
                      <strong>{monthLabel}</strong>
                      <span className="badge">
                        {month.qty > 0 || month.measurementCount > 0
                          ? `${formatNumber(month.activeDays, 0)} ${t('producerHistory.activeDays').toLowerCase()}`
                          : t('producerHistory.noActivity')}
                      </span>
                    </div>

                    <div className="history-month-card-value">{`${formatNumber(month.qty, 0)} L`}</div>

                    <div className="history-month-card-meta">
                      <span>{`${t('producerHistory.fat')}: ${formatNumber(month.fatPct, 2)} %`}</span>
                      <span>{`${t('producerHistory.monthAmount')}: ${formatNumber(month.totalAmount, 0)} RSD`}</span>
                      <span>{`${t('producerHistory.measurements')}: ${formatNumber(month.measurementCount, 0)}`}</span>
                      <span>{`${t('producerHistory.appliedConstants')}: ${month.constantsValidFrom}`}</span>
                    </div>

                    <span className="btn" style={{ pointerEvents: 'none' }}>
                      {t('producerHistory.viewDetails')}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="card" style={{ padding: 14, display: 'grid', gap: 12 }}>
            <div className="history-detail-head">
              <div>
                <h3 style={{ margin: 0 }}>
                  {t('producerHistory.dailyBreakdown')}
                  {selectedMonthSummary
                    ? ` - ${new Date(history.year, selectedMonthSummary.month - 1, 1).toLocaleDateString(locale, {
                        month: 'long',
                        year: 'numeric',
                      })}`
                    : ''}
                </h3>
                <div className="muted" style={{ fontSize: 12 }}>
                  {selectedMonthSummary
                    ? `${t('producerHistory.appliedConstants')}: ${selectedMonthSummary.constantsValidFrom}`
                    : ''}
                </div>
              </div>

              {selectedMonthSummary ? (
                <div className="history-detail-summary">
                  <span className="badge">{`${formatNumber(selectedMonthSummary.qty, 0)} L`}</span>
                  <span className="badge">{`${formatNumber(selectedMonthSummary.fatPct, 2)} %`}</span>
                  <span className="badge">{`${formatNumber(selectedMonthSummary.totalAmount, 0)} RSD`}</span>
                </div>
              ) : null}
            </div>

            {selectedMonthEntries.length === 0 ? (
              <div className="card" style={{ padding: 14, background: 'var(--surface-muted)' }}>
                {t('producerHistory.noMonthData')}
              </div>
            ) : (
              <div className="table-wrap">
                <table className="data-table" style={{ minWidth: 560 }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'center' }}>{t('producerHistory.day')}</th>
                      <th>{t('producerHistory.date')}</th>
                      <th style={{ textAlign: 'right' }}>{t('producerHistory.qty')}</th>
                      <th style={{ textAlign: 'center' }}>{t('producerHistory.fat')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedMonthEntries.map((entry) => (
                      <tr key={entry.date}>
                        <td style={{ textAlign: 'center' }}>{entry.day}</td>
                        <td>{formatDate(entry.date)}</td>
                        <td style={{ textAlign: 'right' }}>{formatNumber(entry.qty, 0)}</td>
                        <td style={{ textAlign: 'center' }}>
                          {entry.fatPct === null ? '-' : formatNumber(entry.fatPct, 2)}
                        </td>
                      </tr>
                    ))}
                    {selectedMonthSummary ? (
                      <tr style={{ background: 'var(--surface-muted)', fontWeight: 700 }}>
                        <td colSpan={2}>{t('table.totals')}</td>
                        <td style={{ textAlign: 'right' }}>{formatNumber(selectedMonthSummary.qty, 0)}</td>
                        <td style={{ textAlign: 'center' }}>{formatNumber(selectedMonthSummary.fatPct, 2)}</td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}
