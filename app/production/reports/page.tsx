'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PeriodToolbar } from '@/components/production/period-toolbar';
import { fetchIntakeSnapshots } from '@/lib/production/intake';
import { useProductionStore } from '@/lib/production/store';
import { filterRecordsByPeriod, filterSnapshotsByPeriod, formatNumber, summarizePackagingMix, summarizeProduction } from '@/lib/production/utils';
import { useTranslation } from '@/lib/i18n/use-translation';
import type { ProductionPeriod, ProductionRecord } from '@/types/production';

type ReportRow = {
  label: string;
  received: number;
  processed: number;
  produced: number;
  packed: number;
  milkWaste: number;
  productWaste: number;
  openStock: number;
  avgYield: number | null;
};

function buildReportRows(
  period: ProductionPeriod,
  year: number,
  filteredDates: string[],
  records: Record<string, ProductionRecord>,
  packagingWeights: Map<string, number>,
  snapshotsByDate: Map<string, { received: number }>
): ReportRow[] {
  if (period === 'day') {
    const date = filteredDates[0];
    if (!date) return [];
    const record = records[date];
    const received = snapshotsByDate.get(date)?.received ?? 0;
    const processed = record?.outputs.reduce((sum, item) => sum + item.milkUsedLiters, 0) ?? 0;
    const produced = record?.outputs.reduce((sum, item) => sum + item.producedKg, 0) ?? 0;
    const packed =
      record?.packaging.reduce((sum, item) => sum + (packagingWeights.get(item.packagingId) ?? 0) * item.packedCount, 0) ?? 0;
    const productWaste = record?.outputs.reduce((sum, item) => sum + item.wasteKg, 0) ?? 0;
    return [
      {
        label: date,
        received,
        processed,
        produced,
        packed,
        milkWaste: record?.milkWasteLiters ?? 0,
        productWaste,
        openStock: Math.max(produced - packed - productWaste, 0),
        avgYield: produced > 0 ? processed / produced : null,
      },
    ];
  }

  if (period === 'week' || period === 'month') {
    return filteredDates.map((date) => {
      const record = records[date];
      const received = snapshotsByDate.get(date)?.received ?? 0;
      const processed = record?.outputs.reduce((sum, item) => sum + item.milkUsedLiters, 0) ?? 0;
      const produced = record?.outputs.reduce((sum, item) => sum + item.producedKg, 0) ?? 0;
      const packed =
        record?.packaging.reduce((sum, item) => sum + (packagingWeights.get(item.packagingId) ?? 0) * item.packedCount, 0) ?? 0;
      const productionWaste = record?.outputs.reduce((sum, item) => sum + item.wasteKg, 0) ?? 0;
      return {
        label: date,
        received,
        processed,
        produced,
        packed,
        milkWaste: record?.milkWasteLiters ?? 0,
        productWaste: productionWaste,
        openStock: Math.max(produced - packed - productionWaste, 0),
        avgYield: produced > 0 ? processed / produced : null,
      };
    });
  }

  return Array.from({ length: 12 }, (_, index) => index + 1).map((month) => {
    const prefix = `${year}-${String(month).padStart(2, '0')}`;
    const monthDates = filteredDates.filter((date) => date.startsWith(prefix));
    const monthRows = buildReportRows('month', year, monthDates, records, packagingWeights, snapshotsByDate);
    return {
      label: prefix,
      received: monthRows.reduce((sum, item) => sum + item.received, 0),
      processed: monthRows.reduce((sum, item) => sum + item.processed, 0),
      produced: monthRows.reduce((sum, item) => sum + item.produced, 0),
      packed: monthRows.reduce((sum, item) => sum + item.packed, 0),
      milkWaste: monthRows.reduce((sum, item) => sum + item.milkWaste, 0),
      productWaste: monthRows.reduce((sum, item) => sum + item.productWaste, 0),
      openStock: monthRows.reduce((sum, item) => sum + item.openStock, 0),
      avgYield:
        monthRows.reduce((sum, item) => sum + item.produced, 0) > 0
          ? monthRows.reduce((sum, item) => sum + item.processed, 0) / monthRows.reduce((sum, item) => sum + item.produced, 0)
          : null,
    };
  });
}

export default function ProductionReportsPage() {
  const now = new Date();
  const { t } = useTranslation();
  const [period, setPeriod] = useState<ProductionPeriod>('month');
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [day, setDay] = useState(now.getDate());
  const packaging = useProductionStore((state) => state.packaging);
  const recordsMap = useProductionStore((state) => state.records);
  const records = useMemo(() => Object.values(recordsMap), [recordsMap]);

  const { data: snapshots = [] } = useQuery({
    queryKey: ['production-reports-intake', period, year, month, day],
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
  const filteredRecords = useMemo(
    () => filterRecordsByPeriod(records, period, year, month, day),
    [day, month, period, records, year]
  );
  const summary = useMemo(
    () => summarizeProduction(filteredSnapshots, filteredRecords, packaging),
    [filteredRecords, filteredSnapshots, packaging]
  );
  const packagingMix = useMemo(() => summarizePackagingMix(filteredRecords, packaging), [filteredRecords, packaging]);

  const packagingWeights = useMemo(() => new Map(packaging.map((item) => [item.id, item.unitWeightKg])), [packaging]);
  const snapshotsByDate = useMemo(
    () => new Map(filteredSnapshots.map((item) => [item.date, { received: item.milkReceivedLiters }])),
    [filteredSnapshots]
  );
  const filteredDates = useMemo(
    () => [...new Set([...filteredSnapshots.map((item) => item.date), ...filteredRecords.map((item) => item.date)])].sort(),
    [filteredRecords, filteredSnapshots]
  );
  const reportRows = useMemo(
    () => buildReportRows(period, year, filteredDates, recordsMap, packagingWeights, snapshotsByDate),
    [filteredDates, packagingWeights, period, recordsMap, snapshotsByDate, year]
  );

  return (
    <div className="module-page">
      <div className="card module-hero-main">
        <div className="production-header-row">
          <div style={{ display: 'grid', gap: 6 }}>
            <h2 style={{ margin: 0 }}>{t('productionReports.title')}</h2>
            <div className="muted">{t('productionReports.subtitle')}</div>
          </div>
          <span className="badge">{t(`production.period${period[0].toUpperCase()}${period.slice(1)}`)}</span>
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
        <div className="card" style={{ padding: 14 }}>
          <div className="muted">{t('production.kpiMilkReceived')}</div>
          <div style={{ fontSize: 26, fontWeight: 700 }}>{`${formatNumber(summary.milkReceivedLiters, 0)} L`}</div>
        </div>
        <div className="card" style={{ padding: 14 }}>
          <div className="muted">{t('production.kpiCheeseMade')}</div>
          <div style={{ fontSize: 26, fontWeight: 700 }}>{`${formatNumber(summary.producedKg, 1)} kg`}</div>
        </div>
        <div className="card" style={{ padding: 14 }}>
          <div className="muted">{t('production.kpiPacked')}</div>
          <div style={{ fontSize: 26, fontWeight: 700 }}>{`${formatNumber(summary.packedKg, 1)} kg`}</div>
        </div>
        <div className="card" style={{ padding: 14 }}>
          <div className="muted">{t('production.kpiAvgYield')}</div>
          <div style={{ fontSize: 26, fontWeight: 700 }}>
            {summary.averageLitersPerKg !== null ? `${formatNumber(summary.averageLitersPerKg, 2)} L/kg` : '-'}
          </div>
        </div>
      </div>

      <div className="module-hero">
        <div className="card module-form-card">
          <div className="production-header-row">
            <strong>{t('productionReports.flowTitle')}</strong>
            <span className="muted">{reportRows.length}</span>
          </div>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t('productionReports.rowLabel')}</th>
                  <th>{t('production.kpiMilkReceived')}</th>
                  <th>{t('production.kpiProcessedMilk')}</th>
                  <th>{t('production.kpiCheeseMade')}</th>
                  <th>{t('production.kpiPacked')}</th>
                  <th>{t('production.kpiMilkWaste')}</th>
                  <th>{t('production.kpiProductWaste')}</th>
                  <th>{t('production.kpiOpenStock')}</th>
                  <th>{t('production.kpiAvgYield')}</th>
                </tr>
              </thead>
              <tbody>
                {reportRows.map((row) => (
                  <tr key={row.label}>
                    <td>{row.label}</td>
                    <td>{`${formatNumber(row.received, 0)} L`}</td>
                    <td>{`${formatNumber(row.processed, 0)} L`}</td>
                    <td>{`${formatNumber(row.produced, 1)} kg`}</td>
                    <td>{`${formatNumber(row.packed, 1)} kg`}</td>
                    <td>{`${formatNumber(row.milkWaste, 0)} L`}</td>
                    <td>{`${formatNumber(row.productWaste, 1)} kg`}</td>
                    <td>{`${formatNumber(row.openStock, 1)} kg`}</td>
                    <td>{row.avgYield !== null ? `${formatNumber(row.avgYield, 2)} L/kg` : '-'}</td>
                  </tr>
                ))}
                {!reportRows.length ? (
                  <tr>
                    <td colSpan={9}>{t('common.noData')}</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card module-side-card">
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
      </div>
    </div>
  );
}
