'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PeriodToolbar } from '@/components/production/period-toolbar';
import { buildPeriodLabel, fetchIntakeSnapshots } from '@/lib/production/intake';
import { useProductionStore } from '@/lib/production/store';
import { filterRecordsByPeriod, filterSnapshotsByPeriod, formatNumber, summarizePackagingMix, summarizeProduction } from '@/lib/production/utils';
import { useTranslation } from '@/lib/i18n/use-translation';
import type { ProductionPeriod } from '@/types/production';

export default function ProductionDashboardPage() {
  const now = new Date();
  const { t } = useTranslation();
  const [period, setPeriod] = useState<ProductionPeriod>('day');
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [day, setDay] = useState(now.getDate());
  const packaging = useProductionStore((state) => state.packaging);
  const recordsMap = useProductionStore((state) => state.records);

  const { data: snapshots = [], isLoading } = useQuery({
    queryKey: ['production-intake', period, year, month, day],
    queryFn: () => fetchIntakeSnapshots(period, year, month, day),
  });

  useEffect(() => {
    const maxDay = new Date(year, month, 0).getDate();
    if (day > maxDay) setDay(maxDay);
  }, [day, month, year]);

  const filteredSnapshots = useMemo(
    () => filterSnapshotsByPeriod(snapshots, period, year, month, day),
    [day, month, period, snapshots, year]
  );
  const periodLabel = useMemo(() => buildPeriodLabel(period, year, month, day), [day, month, period, year]);
  const records = useMemo(() => Object.values(recordsMap), [recordsMap]);
  const filteredRecords = useMemo(
    () => filterRecordsByPeriod(records, period, year, month, day),
    [day, month, period, records, year]
  );
  const summary = useMemo(
    () => summarizeProduction(filteredSnapshots, filteredRecords, packaging),
    [filteredRecords, filteredSnapshots, packaging]
  );
  const packagingMix = useMemo(() => summarizePackagingMix(filteredRecords, packaging).slice(0, 4), [filteredRecords, packaging]);

  const milkGap = summary.milkReceivedLiters - summary.processedMilkLiters - summary.carryoverMilkLiters - summary.milkWasteLiters;
  const packGap = summary.producedKg - summary.packedKg - summary.productionWasteKg;

  const healthChecks = [
    {
      label: t('production.healthMilkBalance'),
      value: `${formatNumber(Math.abs(milkGap), 1)} L`,
      ok: Math.abs(milkGap) < 0.01,
    },
    {
      label: t('production.healthPackagingBalance'),
      value: `${formatNumber(Math.abs(packGap), 1)} kg`,
      ok: Math.abs(packGap) < 0.01,
    },
  ];

  const kpis = [
    { label: t('production.kpiMilkReceived'), value: `${formatNumber(summary.milkReceivedLiters, 0)} L` },
    { label: t('production.kpiProcessedMilk'), value: `${formatNumber(summary.processedMilkLiters, 0)} L` },
    { label: t('production.kpiCheeseMade'), value: `${formatNumber(summary.producedKg, 1)} kg` },
    { label: t('production.kpiPacked'), value: `${formatNumber(summary.packedKg, 1)} kg` },
    { label: t('production.kpiOpenStock'), value: `${formatNumber(summary.openStockKg, 1)} kg` },
    {
      label: t('production.kpiAvgYield'),
      value: summary.averageLitersPerKg !== null ? `${formatNumber(summary.averageLitersPerKg, 2)} L/kg` : '-',
    },
    {
      label: t('production.kpiFatUnit'),
      value: summary.averageFatUnit !== null ? formatNumber(summary.averageFatUnit, 2) : '-',
    },
    { label: t('production.kpiCarryoverMilk'), value: `${formatNumber(summary.carryoverMilkLiters, 0)} L` },
  ];

  const quickLinks = [
    { href: '/production/daily-entry', title: t('production.entryCard'), text: t('production.entryCardText') },
    { href: '/production/reports', title: t('production.reportsCard'), text: t('production.reportsCardText') },
    { href: '/production/traceability', title: t('production.traceCard'), text: t('production.traceCardText') },
    { href: '/production/products', title: t('production.productsCard'), text: t('production.productsCardText') },
  ];

  return (
    <div className="module-page">
      <div className="card module-hero-main">
        <div className="production-header-row">
          <div style={{ display: 'grid', gap: 6 }}>
            <h2 style={{ margin: 0 }}>{t('production.dashboardTitle')}</h2>
            <div className="muted">{t('production.dashboardSubtitle')}</div>
          </div>
          <div className="badge">{isLoading ? t('common.loading') : `${filteredSnapshots.length} ${t('production.daysCovered')}`}</div>
        </div>

        <PeriodToolbar
          period={period}
          year={year}
          month={month}
          day={day}
          onPeriodChange={setPeriod}
          onYearChange={setYear}
          onMonthChange={setMonth}
          onDayChange={setDay}
          labels={{
            period: t('daily.period'),
            year: t('daily.year'),
            month: t('daily.month'),
            day: t('daily.day'),
            dayOption: t('production.periodDay'),
            weekOption: t('production.periodWeek'),
            monthOption: t('production.periodMonth'),
            yearOption: t('production.periodYear'),
          }}
        />
      </div>

      <div className="module-kpi-grid">
        {kpis.map((item) => (
          <div key={item.label} className="card" style={{ padding: 14 }}>
            <div className="muted">{item.label}</div>
            <div style={{ fontSize: 26, fontWeight: 700 }}>{item.value}</div>
          </div>
        ))}
      </div>

      <div className="module-hero">
        <div className="card module-form-card">
          <div className="production-header-row">
            <strong>{t('production.healthTitle')}</strong>
            <span className="muted" style={{ fontSize: 12 }}>
              {periodLabel}
            </span>
          </div>
          <div className="production-subgrid">
            {healthChecks.map((item) => (
              <div key={item.label} className={`production-inline-card ${item.ok ? 'production-state-ok' : 'production-state-warn'}`}>
                <div className="muted">{item.label}</div>
                <strong>{item.value}</strong>
              </div>
            ))}
            <div className="production-inline-card">
              <div className="muted">{t('production.daysWithIntake')}</div>
              <strong>{summary.intakeDays}</strong>
            </div>
            <div className="production-inline-card">
              <div className="muted">{t('production.daysWithProduction')}</div>
              <strong>{summary.productionDays}</strong>
            </div>
          </div>
        </div>

        <div className="card module-side-card">
          <div className="muted" style={{ fontSize: 12 }}>
            {t('production.nextViews')}
          </div>
          <div className="module-link-grid">
            {quickLinks.map((item) => (
              <Link key={item.href} href={item.href} className="module-link-card">
                <strong>{item.title}</strong>
                <span className="muted">{item.text}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>

      <div className="module-hero">
        <div className="card module-form-card">
          <div className="production-header-row">
            <strong>{t('production.packagingMix')}</strong>
            <span className="muted">{t('production.kpiPacked')}</span>
          </div>
          <div className="module-summary-stack">
            {packagingMix.length ? (
              packagingMix.map((item) => (
                <div key={item.packagingId}>
                  <span>{item.label}</span>
                  <strong>{`${formatNumber(item.count, 0)} / ${formatNumber(item.packedKg, 1)} kg`}</strong>
                </div>
              ))
            ) : (
              <div>
                <span>{t('common.noData')}</span>
                <strong>-</strong>
              </div>
            )}
          </div>
        </div>

        <div className="card module-side-card">
          <div className="production-header-row">
            <strong>{t('production.sourceFromPurchase')}</strong>
            <span className="muted">{t('production.kpiMilkReceived')}</span>
          </div>
          <div className="module-summary-stack">
            {filteredSnapshots.slice(0, period === 'day' ? 1 : 5).map((item) => (
              <div key={item.date}>
                <span>{item.date}</span>
                <strong>{`${formatNumber(item.milkReceivedLiters, 0)} L`}</strong>
              </div>
            ))}
            {!filteredSnapshots.length ? (
              <div>
                <span>{t('common.noData')}</span>
                <strong>-</strong>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
