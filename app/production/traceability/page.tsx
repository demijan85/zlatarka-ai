'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PeriodToolbar } from '@/components/production/period-toolbar';
import { fetchIntakeSnapshots } from '@/lib/production/intake';
import { useProductionStore } from '@/lib/production/store';
import { buildBatchCode, filterRecordsByPeriod, filterSnapshotsByPeriod, formatNumber } from '@/lib/production/utils';
import { useTranslation } from '@/lib/i18n/use-translation';
import type { ProductionPeriod } from '@/types/production';

export default function ProductionTraceabilityPage() {
  const now = new Date();
  const { t } = useTranslation();
  const [period, setPeriod] = useState<ProductionPeriod>('month');
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [day, setDay] = useState(now.getDate());
  const packaging = useProductionStore((state) => state.packaging);
  const products = useProductionStore((state) => state.products);
  const recordsMap = useProductionStore((state) => state.records);
  const records = useMemo(() => Object.values(recordsMap), [recordsMap]);

  const { data: snapshots = [] } = useQuery({
    queryKey: ['production-traceability-intake', period, year, month, day],
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
  const snapshotsMap = useMemo(() => new Map(filteredSnapshots.map((item) => [item.date, item])), [filteredSnapshots]);

  const rows = useMemo(
    () =>
      filteredRecords.flatMap((record) =>
        (Array.isArray(record.outputs) ? record.outputs : []).map((output) => {
          const product = products.find((item) => item.id === output.productId);
          const relatedPackaging = (Array.isArray(record.packaging) ? record.packaging : [])
            .map((item) => {
              const definition = packaging.find((packagingItem) => packagingItem.id === item.packagingId);
              if (!definition || definition.productId !== output.productId || item.packedCount <= 0) return null;
              return `${definition.label}: ${item.packedCount}`;
            })
            .filter((item): item is string => Boolean(item))
            .join(', ');
          const snapshot = snapshotsMap.get(record.date);
          return {
            date: record.date,
            intakeLot: `${record.date.replaceAll('-', '')}-MILK`,
            outputLot: buildBatchCode(record.date, output.productId),
            productName: product?.name ?? output.productId,
            milkReceived: snapshot?.milkReceivedLiters ?? 0,
            milkUsed: output.milkUsedLiters,
            producedKg: output.producedKg,
            packedText: relatedPackaging || '-',
            carryoverMilk: record.carryoverMilkLiters,
            status:
              output.producedKg > 0 && output.milkUsedLiters > 0
                ? t('productionTrace.statusClosed')
                : t('productionTrace.statusDraft'),
          };
        })
      ),
    [filteredRecords, packaging, products, snapshotsMap, t]
  );

  return (
    <div className="module-page">
      <div className="card module-hero-main">
        <div className="production-header-row">
          <div style={{ display: 'grid', gap: 6 }}>
            <h2 style={{ margin: 0 }}>{t('productionTrace.title')}</h2>
            <div className="muted">{t('productionTrace.subtitle')}</div>
          </div>
          <span className="badge">{rows.length}</span>
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

      <div className="card module-form-card">
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('daily.day')}</th>
                <th>{t('productionTrace.intakeLot')}</th>
                <th>{t('productionTrace.outputLot')}</th>
                <th>{t('productionTrace.product')}</th>
                <th>{t('production.kpiMilkReceived')}</th>
                <th>{t('productionTrace.milkUsed')}</th>
                <th>{t('production.kpiCheeseMade')}</th>
                <th>{t('productionTrace.packaging')}</th>
                <th>{t('production.kpiCarryoverMilk')}</th>
                <th>{t('productionTrace.status')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={`${row.outputLot}-${row.date}`}>
                  <td>{row.date}</td>
                  <td>{row.intakeLot}</td>
                  <td>{row.outputLot}</td>
                  <td>{row.productName}</td>
                  <td>{`${formatNumber(row.milkReceived, 0)} L`}</td>
                  <td>{`${formatNumber(row.milkUsed, 0)} L`}</td>
                  <td>{`${formatNumber(row.producedKg, 1)} kg`}</td>
                  <td>{row.packedText}</td>
                  <td>{`${formatNumber(row.carryoverMilk, 0)} L`}</td>
                  <td>{row.status}</td>
                </tr>
              ))}
              {!rows.length ? (
                <tr>
                  <td colSpan={10}>{t('common.noData')}</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
