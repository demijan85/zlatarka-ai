'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { DailyIntakeLock, MonthlySummaryRow, Supplier } from '@/types/domain';
import { useTranslation } from '@/lib/i18n/use-translation';
import { localeForLanguage } from '@/lib/i18n/locale';

type Period = 'first' | 'second' | 'all';

type KpiSnapshot = {
  totalQty: number;
  totalAmount: number;
  activeSuppliers: number;
  avgFatPct: number;
  avgPricePerL: number;
  stimulationAmount: number;
  topSupplierName: string | null;
  topSupplierQty: number;
};

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

async function fetchLockStatus(year: number, month: number): Promise<DailyIntakeLock> {
  const response = await fetch(`/api/daily-entries/lock?year=${year}&month=${month}`);
  if (!response.ok) throw await parseError(response, 'Failed to fetch lock status');
  return response.json();
}

function computeKpis(rows: MonthlySummaryRow[]): KpiSnapshot {
  const totalQty = rows.reduce((sum, item) => sum + item.qty, 0);
  const totalAmount = rows.reduce((sum, item) => sum + item.totalAmount, 0);
  const weightedFat = rows.reduce((sum, item) => sum + item.qty * item.fatPct, 0);
  const stimulationAmount = rows.reduce((sum, item) => sum + item.qty * item.stimulation, 0);
  const topSupplier = rows.reduce<MonthlySummaryRow | null>((current, row) => {
    if (!current || row.qty > current.qty) return row;
    return current;
  }, null);

  return {
    totalQty,
    totalAmount,
    activeSuppliers: rows.length,
    avgFatPct: totalQty > 0 ? weightedFat / totalQty : 0,
    avgPricePerL: totalQty > 0 ? totalAmount / totalQty : 0,
    stimulationAmount,
    topSupplierName: topSupplier ? `${topSupplier.firstName} ${topSupplier.lastName}` : null,
    topSupplierQty: topSupplier?.qty ?? 0,
  };
}

function getPreviousMonth(year: number, month: number): { year: number; month: number } {
  if (month === 1) {
    return { year: year - 1, month: 12 };
  }
  return { year, month: month - 1 };
}

export default function DashboardPage() {
  const now = new Date();
  const { t, language } = useTranslation();
  const locale = localeForLanguage(language);
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [city, setCity] = useState('');
  const [period, setPeriod] = useState<Period>('all');
  const previous = getPreviousMonth(year, month);

  const monthlyQuery = useQuery({
    queryKey: ['dashboard-monthly', year, month, city, period],
    queryFn: () => fetchMonthly(year, month, city, period),
  });

  const previousMonthlyQuery = useQuery({
    queryKey: ['dashboard-monthly-previous', previous.year, previous.month, city, period],
    queryFn: () => fetchMonthly(previous.year, previous.month, city, period),
  });

  const lockQuery = useQuery({
    queryKey: ['dashboard-lock', year, month],
    queryFn: () => fetchLockStatus(year, month),
  });

  const { data: cities = [] } = useQuery({ queryKey: ['supplier-cities'], queryFn: fetchCities });

  const rows = useMemo(() => monthlyQuery.data ?? [], [monthlyQuery.data]);
  const current = useMemo(() => computeKpis(monthlyQuery.data ?? []), [monthlyQuery.data]);
  const previousKpis = useMemo(() => computeKpis(previousMonthlyQuery.data ?? []), [previousMonthlyQuery.data]);
  const topByQty = useMemo(
    () =>
      [...rows]
        .sort((a, b) => b.qty - a.qty || b.fatPct - a.fatPct)
        .slice(0, 10),
    [rows]
  );
  const topByQuality = useMemo(
    () =>
      [...rows]
        .sort((a, b) => b.fatPct - a.fatPct || b.qty - a.qty)
        .slice(0, 10),
    [rows]
  );

  function formatNumber(value: number, digits = 0): string {
    return value.toLocaleString(locale, { minimumFractionDigits: digits, maximumFractionDigits: digits });
  }

  function formatDelta(currentValue: number, previousValue: number, digits = 0): { text: string; color: string } {
    const delta = currentValue - previousValue;
    const sign = delta > 0 ? '+' : '';
    return {
      text: `${sign}${formatNumber(delta, digits)} ${t('dashboard.vsPrevious')}`,
      color: delta < 0 ? 'var(--danger)' : 'var(--primary)',
    };
  }

  const qtyDelta = formatDelta(current.totalQty, previousKpis.totalQty, 0);
  const amountDelta = formatDelta(current.totalAmount, previousKpis.totalAmount, 0);

  const isLoading = monthlyQuery.isLoading || previousMonthlyQuery.isLoading || lockQuery.isLoading;
  const error = monthlyQuery.error || previousMonthlyQuery.error || lockQuery.error;

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div className="card" style={{ padding: 12, display: 'grid', gap: 10 }}>
        <h2 style={{ margin: 0 }}>{t('dashboard.title')}</h2>
        <div className="muted" style={{ fontSize: 12 }}>
          {t('dashboard.subtitle')}
        </div>

        <div className="control-row">
          <select className="input" value={year} onChange={(event) => setYear(Number(event.target.value))}>
            {Array.from({ length: 6 }, (_, index) => now.getFullYear() - 2 + index).map((itemYear) => (
              <option key={itemYear} value={itemYear}>
                {itemYear}
              </option>
            ))}
          </select>

          <select className="input" value={month} onChange={(event) => setMonth(Number(event.target.value))}>
            {Array.from({ length: 12 }, (_, index) => index + 1).map((itemMonth) => (
              <option key={itemMonth} value={itemMonth}>
                {new Date(year, itemMonth - 1, 1).toLocaleDateString(locale, { month: 'long' })}
              </option>
            ))}
          </select>

          <select className="input" value={period} onChange={(event) => setPeriod(event.target.value as Period)}>
            <option value="all">{t('monthly.fullMonth')}</option>
            <option value="first">{t('monthly.firstHalf')}</option>
            <option value="second">{t('monthly.secondHalf')}</option>
          </select>

          <select className="input" value={city} onChange={(event) => setCity(event.target.value)}>
            <option value="">{t('common.allCities')}</option>
            {cities.map((itemCity) => (
              <option key={itemCity} value={itemCity}>
                {itemCity}
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

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
        <div className="card" style={{ padding: 14 }}>
          <div className="muted">{t('dashboard.totalQty')}</div>
          <div style={{ fontSize: 26, fontWeight: 700 }}>{isLoading ? '...' : `${formatNumber(current.totalQty, 0)} L`}</div>
          {!isLoading ? (
            <div className="muted" style={{ fontSize: 12, color: qtyDelta.color }}>
              {qtyDelta.text}
            </div>
          ) : null}
        </div>

        <div className="card" style={{ padding: 14 }}>
          <div className="muted">{t('dashboard.totalAmount')}</div>
          <div style={{ fontSize: 26, fontWeight: 700 }}>{isLoading ? '...' : `${formatNumber(current.totalAmount, 0)} RSD`}</div>
          {!isLoading ? (
            <div className="muted" style={{ fontSize: 12, color: amountDelta.color }}>
              {amountDelta.text}
            </div>
          ) : null}
        </div>

        <div className="card" style={{ padding: 14 }}>
          <div className="muted">{t('dashboard.avgFat')}</div>
          <div style={{ fontSize: 26, fontWeight: 700 }}>{isLoading ? '...' : `${formatNumber(current.avgFatPct, 2)} %`}</div>
        </div>

        <div className="card" style={{ padding: 14 }}>
          <div className="muted">{t('dashboard.activeSuppliers')}</div>
          <div style={{ fontSize: 26, fontWeight: 700 }}>{isLoading ? '...' : formatNumber(current.activeSuppliers, 0)}</div>
        </div>

        <div className="card" style={{ padding: 14 }}>
          <div className="muted">{t('dashboard.avgPricePerL')}</div>
          <div style={{ fontSize: 26, fontWeight: 700 }}>{isLoading ? '...' : `${formatNumber(current.avgPricePerL, 2)} RSD`}</div>
        </div>

        <div className="card" style={{ padding: 14 }}>
          <div className="muted">{t('dashboard.totalStimulation')}</div>
          <div style={{ fontSize: 26, fontWeight: 700 }}>{isLoading ? '...' : `${formatNumber(current.stimulationAmount, 0)} RSD`}</div>
        </div>

        <div className="card" style={{ padding: 14 }}>
          <div className="muted">{t('dashboard.topSupplier')}</div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>
            {isLoading ? '...' : current.topSupplierName ?? t('dashboard.noTopSupplier')}
          </div>
          {!isLoading && current.topSupplierName ? (
            <div className="muted" style={{ fontSize: 12 }}>
              {`${formatNumber(current.topSupplierQty, 0)} L`}
            </div>
          ) : null}
        </div>

        <div className="card" style={{ padding: 14 }}>
          <div className="muted">{t('dashboard.monthStatus')}</div>
          <div style={{ marginTop: 8 }}>
            <span
              className="badge"
              style={{
                background: lockQuery.data?.isLocked ? '#fee2e2' : 'var(--primary-weak)',
                color: lockQuery.data?.isLocked ? '#991b1b' : '#115e59',
              }}
            >
              {isLoading ? '...' : lockQuery.data?.isLocked ? t('daily.locked') : t('daily.unlocked')}
            </span>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 12 }}>
        <div className="card" style={{ padding: 12, display: 'grid', gap: 8 }}>
          <h3 style={{ margin: 0 }}>{t('dashboard.top10ByQty')}</h3>
          <div className="table-wrap">
            <table className="kpi-table">
              <thead>
                <tr>
                  <th style={{ textAlign: 'center' }}>{t('dashboard.rank')}</th>
                  <th>{t('daily.supplier')}</th>
                  <th style={{ textAlign: 'right' }}>{t('monthly.qty')}</th>
                  <th style={{ textAlign: 'center' }}>{t('monthly.mm')}</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={4}>{t('common.loading')}</td>
                  </tr>
                ) : topByQty.length === 0 ? (
                  <tr>
                    <td colSpan={4}>{t('common.noData')}</td>
                  </tr>
                ) : (
                  topByQty.map((item, index) => (
                    <tr key={`qty-${item.supplierId}`}>
                      <td style={{ textAlign: 'center' }}>{index + 1}</td>
                      <td>{`${item.firstName} ${item.lastName}`}</td>
                      <td style={{ textAlign: 'right' }}>{formatNumber(item.qty, 0)}</td>
                      <td style={{ textAlign: 'center' }}>{formatNumber(item.fatPct, 2)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card" style={{ padding: 12, display: 'grid', gap: 8 }}>
          <h3 style={{ margin: 0 }}>{t('dashboard.top10ByQuality')}</h3>
          <div className="table-wrap">
            <table className="kpi-table">
              <thead>
                <tr>
                  <th style={{ textAlign: 'center' }}>{t('dashboard.rank')}</th>
                  <th>{t('daily.supplier')}</th>
                  <th style={{ textAlign: 'center' }}>{t('monthly.mm')}</th>
                  <th style={{ textAlign: 'right' }}>{t('monthly.qty')}</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={4}>{t('common.loading')}</td>
                  </tr>
                ) : topByQuality.length === 0 ? (
                  <tr>
                    <td colSpan={4}>{t('common.noData')}</td>
                  </tr>
                ) : (
                  topByQuality.map((item, index) => (
                    <tr key={`quality-${item.supplierId}`}>
                      <td style={{ textAlign: 'center' }}>{index + 1}</td>
                      <td>{`${item.firstName} ${item.lastName}`}</td>
                      <td style={{ textAlign: 'center' }}>{formatNumber(item.fatPct, 2)}</td>
                      <td style={{ textAlign: 'right' }}>{formatNumber(item.qty, 0)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
