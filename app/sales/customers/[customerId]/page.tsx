'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { PeriodToolbar } from '@/components/production/period-toolbar';
import { useTranslation } from '@/lib/i18n/use-translation';
import { useProductionStore } from '@/lib/production/store';
import { formatNumber } from '@/lib/production/utils';
import { useSalesStore } from '@/lib/sales/store';
import { buildCustomerRows, filterDispatchesByPeriod, sumDispatchKg, sumDispatchUnits } from '@/lib/sales/utils';
import type { ProductionPeriod } from '@/types/production';

export default function SalesCustomerViewPage() {
  const now = new Date();
  const { t } = useTranslation();
  const params = useParams<{ customerId: string }>();
  const packaging = useProductionStore((state) => state.packaging);
  const customers = useSalesStore((state) => state.customers);
  const dispatchesMap = useSalesStore((state) => state.dispatches);
  const [period, setPeriod] = useState<ProductionPeriod>('month');
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [day, setDay] = useState(now.getDate());

  const customer = customers.find((item) => item.id === params.customerId);
  const customerDispatches = useMemo(
    () => Object.values(dispatchesMap).filter((item) => item.customerId === params.customerId),
    [dispatchesMap, params.customerId]
  );
  const filteredDispatches = useMemo(
    () => filterDispatchesByPeriod(customerDispatches, period, year, month, day),
    [customerDispatches, day, month, period, year]
  );
  const rows = useMemo(() => buildCustomerRows(filteredDispatches, packaging, period), [filteredDispatches, packaging, period]);

  const totalUnits = filteredDispatches.reduce((sum, item) => sum + sumDispatchUnits(item), 0);
  const totalKg = filteredDispatches.reduce((sum, item) => sum + sumDispatchKg(item, packaging), 0);

  return (
    <div className="module-page">
      <div className="card module-hero-main">
        <div className="production-header-row">
          <div style={{ display: 'grid', gap: 6 }}>
            <h2 style={{ margin: 0 }}>{customer?.name || customer?.code || t('sales.customerView')}</h2>
            <div className="muted">{customer?.city || customer?.phone || t('sales.customerViewSubtitle')}</div>
          </div>
          <Link className="btn" href="/sales/customers">
            {t('sales.manageCustomers')}
          </Link>
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
          <div className="muted">{t('sales.kpiDeliveries')}</div>
          <div style={{ fontSize: 26, fontWeight: 700 }}>{filteredDispatches.length}</div>
        </div>
        <div className="card" style={{ padding: 14 }}>
          <div className="muted">{t('sales.kpiSoldUnits')}</div>
          <div style={{ fontSize: 26, fontWeight: 700 }}>{formatNumber(totalUnits, 0)}</div>
        </div>
        <div className="card" style={{ padding: 14 }}>
          <div className="muted">{t('sales.kpiSoldKg')}</div>
          <div style={{ fontSize: 26, fontWeight: 700 }}>{`${formatNumber(totalKg, 1)} kg`}</div>
        </div>
      </div>

      <div className="card module-form-card">
        <div className="production-header-row">
          <strong>{t('sales.customerTimeline')}</strong>
          <span className="muted">{rows.length}</span>
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('productionReports.rowLabel')}</th>
                <th>{t('sales.kpiSoldUnits')}</th>
                <th>{t('sales.kpiSoldKg')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.label}>
                  <td>{row.label}</td>
                  <td>{formatNumber(row.units, 0)}</td>
                  <td>{`${formatNumber(row.kg, 1)} kg`}</td>
                </tr>
              ))}
              {!rows.length ? (
                <tr>
                  <td colSpan={3}>{t('common.noData')}</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
