'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { PeriodToolbar } from '@/components/production/period-toolbar';
import { useTranslation } from '@/lib/i18n/use-translation';
import { useProductionStore } from '@/lib/production/store';
import { formatNumber } from '@/lib/production/utils';
import { useSalesStore } from '@/lib/sales/store';
import { buildCustomerName, filterDispatchesByPeriod, sumDispatchKg, sumDispatchUnits, summarizeInventory } from '@/lib/sales/utils';
import type { ProductionPeriod } from '@/types/production';

export default function SalesDashboardPage() {
  const now = new Date();
  const { t } = useTranslation();
  const [period, setPeriod] = useState<ProductionPeriod>('month');
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [day, setDay] = useState(now.getDate());
  const packaging = useProductionStore((state) => state.packaging);
  const productionRecordsMap = useProductionStore((state) => state.records);
  const customers = useSalesStore((state) => state.customers);
  const dispatchesMap = useSalesStore((state) => state.dispatches);

  const productionRecords = useMemo(() => Object.values(productionRecordsMap), [productionRecordsMap]);
  const dispatches = useMemo(() => Object.values(dispatchesMap).sort((left, right) => right.date.localeCompare(left.date)), [dispatchesMap]);
  const filteredDispatches = useMemo(
    () => filterDispatchesByPeriod(dispatches, period, year, month, day),
    [day, dispatches, month, period, year]
  );
  const inventory = useMemo(() => summarizeInventory(packaging, productionRecords, dispatches), [dispatches, packaging, productionRecords]);

  const periodUnits = filteredDispatches.reduce((sum, dispatch) => sum + sumDispatchUnits(dispatch), 0);
  const periodKg = filteredDispatches.reduce((sum, dispatch) => sum + sumDispatchKg(dispatch, packaging), 0);
  const onHandUnits = inventory.reduce((sum, row) => sum + row.onHandCount, 0);
  const onHandKg = inventory.reduce((sum, row) => sum + row.onHandKg, 0);

  const topCustomers = useMemo(() => {
    const totals = new Map<string, number>();

    for (const dispatch of filteredDispatches) {
      totals.set(dispatch.customerId, (totals.get(dispatch.customerId) ?? 0) + sumDispatchKg(dispatch, packaging));
    }

    return [...totals.entries()]
      .map(([customerId, kg]) => ({
        customerId,
        kg,
        customer: customers.find((item) => item.id === customerId),
      }))
      .sort((left, right) => right.kg - left.kg)
      .slice(0, 5);
  }, [customers, filteredDispatches, packaging]);

  return (
    <div className="module-page">
      <div className="card module-hero-main">
        <div className="production-header-row">
          <div style={{ display: 'grid', gap: 6 }}>
            <h2 style={{ margin: 0 }}>{t('sales.dashboardTitle')}</h2>
            <div className="muted">{t('sales.dashboardSubtitle')}</div>
          </div>
          <div className="control-row">
            <Link className="btn" href="/sales/customers">
              {t('sales.manageCustomers')}
            </Link>
            <Link className="btn primary" href="/sales/deliveries">
              {t('sales.addDelivery')}
            </Link>
          </div>
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
          <div className="muted">{t('sales.kpiOnHand')}</div>
          <div style={{ fontSize: 26, fontWeight: 700 }}>{`${formatNumber(onHandUnits, 0)} / ${formatNumber(onHandKg, 1)} kg`}</div>
        </div>
        <div className="card" style={{ padding: 14 }}>
          <div className="muted">{t('sales.kpiDeliveries')}</div>
          <div style={{ fontSize: 26, fontWeight: 700 }}>{filteredDispatches.length}</div>
        </div>
        <div className="card" style={{ padding: 14 }}>
          <div className="muted">{t('sales.kpiSoldUnits')}</div>
          <div style={{ fontSize: 26, fontWeight: 700 }}>{formatNumber(periodUnits, 0)}</div>
        </div>
        <div className="card" style={{ padding: 14 }}>
          <div className="muted">{t('sales.kpiSoldKg')}</div>
          <div style={{ fontSize: 26, fontWeight: 700 }}>{`${formatNumber(periodKg, 1)} kg`}</div>
        </div>
      </div>

      <div className="module-hero">
        <div className="card module-form-card">
          <div className="production-header-row">
            <strong>{t('sales.inventoryTitle')}</strong>
            <span className="muted">{t('sales.inventorySubtitle')}</span>
          </div>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t('productionProducts.packageLabel')}</th>
                  <th>{t('sales.produced')}</th>
                  <th>{t('sales.delivered')}</th>
                  <th>{t('sales.onHand')}</th>
                </tr>
              </thead>
              <tbody>
                {inventory.map((row) => (
                  <tr key={row.packagingId}>
                    <td>{row.label}</td>
                    <td>{`${formatNumber(row.producedCount, 0)} / ${formatNumber(row.producedCount * row.unitWeightKg, 1)} kg`}</td>
                    <td>{`${formatNumber(row.soldCount, 0)} / ${formatNumber(row.soldCount * row.unitWeightKg, 1)} kg`}</td>
                    <td style={row.onHandCount < 0 ? { color: 'var(--danger)' } : undefined}>
                      {`${formatNumber(row.onHandCount, 0)} / ${formatNumber(row.onHandKg, 1)} kg`}
                    </td>
                  </tr>
                ))}
                {!inventory.length ? (
                  <tr>
                    <td colSpan={4}>{t('common.noData')}</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card module-side-card">
          <div className="production-header-row">
            <strong>{t('sales.topCustomers')}</strong>
            <span className="muted">{t('sales.kpiSoldKg')}</span>
          </div>
          <div className="module-summary-stack">
            {topCustomers.map((item) => (
              <div key={item.customerId}>
                <span>{buildCustomerName(item.customer)}</span>
                <strong>{`${formatNumber(item.kg, 1)} kg`}</strong>
              </div>
            ))}
            {!topCustomers.length ? (
              <div>
                <span>{t('common.noData')}</span>
                <strong>-</strong>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="card module-form-card">
        <div className="production-header-row">
          <strong>{t('sales.recentDeliveries')}</strong>
          <span className="muted">{filteredDispatches.length}</span>
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('daily.day')}</th>
                <th>{t('sales.customer')}</th>
                <th>{t('sales.kpiSoldUnits')}</th>
                <th>{t('sales.kpiSoldKg')}</th>
              </tr>
            </thead>
            <tbody>
              {filteredDispatches.slice(0, 12).map((dispatch) => (
                <tr key={dispatch.id}>
                  <td>{dispatch.date}</td>
                  <td>{buildCustomerName(customers.find((item) => item.id === dispatch.customerId))}</td>
                  <td>{formatNumber(sumDispatchUnits(dispatch), 0)}</td>
                  <td>{`${formatNumber(sumDispatchKg(dispatch, packaging), 1)} kg`}</td>
                </tr>
              ))}
              {!filteredDispatches.length ? (
                <tr>
                  <td colSpan={4}>{t('common.noData')}</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
