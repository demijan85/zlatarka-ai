'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { PeriodToolbar } from '@/components/production/period-toolbar';
import { useTranslation } from '@/lib/i18n/use-translation';
import { useProductionStore } from '@/lib/production/store';
import { buildDate, formatNumber } from '@/lib/production/utils';
import { useSalesStore } from '@/lib/sales/store';
import { buildCustomerName, buildDispatchLabel, filterDispatchesByPeriod, sumDispatchKg, summarizeInventory } from '@/lib/sales/utils';
import type { ProductionPeriod } from '@/types/production';
import type { SalesDispatchItem } from '@/types/sales';

function mergeDraftItems(current: SalesDispatchItem[], packagingIds: string[]) {
  return packagingIds.map((packagingId) => current.find((item) => item.packagingId === packagingId) ?? { packagingId, quantity: 0 });
}

export default function SalesDeliveriesPage() {
  const now = new Date();
  const { t } = useTranslation();
  const packaging = useProductionStore((state) => state.packaging);
  const productionRecordsMap = useProductionStore((state) => state.records);
  const customers = useSalesStore((state) => state.customers);
  const dispatchesMap = useSalesStore((state) => state.dispatches);
  const upsertDispatch = useSalesStore((state) => state.upsertDispatch);
  const removeDispatch = useSalesStore((state) => state.removeDispatch);
  const [period, setPeriod] = useState<ProductionPeriod>('month');
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [day, setDay] = useState(now.getDate());
  const [customerId, setCustomerId] = useState('');
  const [note, setNote] = useState('');
  const [message, setMessage] = useState('');
  const [items, setItems] = useState<SalesDispatchItem[]>([]);

  const activePackaging = useMemo(() => packaging.filter((item) => item.active), [packaging]);
  const productionRecords = useMemo(() => Object.values(productionRecordsMap), [productionRecordsMap]);
  const dispatches = useMemo(() => Object.values(dispatchesMap).sort((left, right) => right.date.localeCompare(left.date)), [dispatchesMap]);
  const inventory = useMemo(() => summarizeInventory(activePackaging, productionRecords, dispatches), [activePackaging, dispatches, productionRecords]);
  const inventoryMap = useMemo(() => new Map(inventory.map((item) => [item.packagingId, item.onHandCount])), [inventory]);
  const filteredDispatches = useMemo(
    () => filterDispatchesByPeriod(dispatches, period, year, month, day),
    [day, dispatches, month, period, year]
  );

  useEffect(() => {
    setItems((current) => mergeDraftItems(current, activePackaging.map((item) => item.id)));
  }, [activePackaging]);

  function updateItem(packagingId: string, quantity: number) {
    setItems((current) => current.map((item) => (item.packagingId === packagingId ? { ...item, quantity } : item)));
  }

  function saveDispatch() {
    const date = buildDate(year, month, day);
    const nonZeroItems = items.filter((item) => item.quantity > 0);

    if (!customerId) {
      setMessage(t('sales.pickCustomer'));
      return;
    }

    if (!nonZeroItems.length) {
      setMessage(t('sales.pickItems'));
      return;
    }

    const exceedsStock = nonZeroItems.find((item) => item.quantity > (inventoryMap.get(item.packagingId) ?? 0));
    if (exceedsStock) {
      setMessage(t('sales.stockExceeded'));
      return;
    }

    upsertDispatch({
      id: '',
      date,
      customerId,
      note,
      items: nonZeroItems,
      updatedAt: new Date().toISOString(),
    });

    setItems(mergeDraftItems([], activePackaging.map((item) => item.id)));
    setNote('');
    setMessage(t('sales.deliverySaved'));
  }

  return (
    <div className="module-page">
      <div className="card module-hero-main">
        <div className="production-header-row">
          <div style={{ display: 'grid', gap: 6 }}>
            <h2 style={{ margin: 0 }}>{t('sales.deliveriesTitle')}</h2>
            <div className="muted">{t('sales.deliveriesSubtitle')}</div>
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

      <div className="module-hero">
        <div className="card module-form-card">
          <div className="production-header-row">
            <strong>{t('sales.addDelivery')}</strong>
            <span className="badge">{buildDate(year, month, day)}</span>
          </div>

          <div className="module-form-grid">
            <label className="module-field">
              <span>{t('sales.customer')}</span>
              <select className="input" value={customerId} onChange={(event) => setCustomerId(event.target.value)}>
                <option value="">{t('sales.selectCustomer')}</option>
                {customers.filter((item) => item.active).map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {buildCustomerName(customer)}
                  </option>
                ))}
              </select>
            </label>
            <label className="module-field">
              <span>{t('productionEntry.productionNote')}</span>
              <input className="input" value={note} onChange={(event) => setNote(event.target.value)} />
            </label>
          </div>

          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t('productionProducts.packageLabel')}</th>
                  <th>{t('sales.onHand')}</th>
                  <th>{t('sales.deliveryQty')}</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const definition = activePackaging.find((packagingItem) => packagingItem.id === item.packagingId);
                  const onHand = inventoryMap.get(item.packagingId) ?? 0;

                  return (
                    <tr key={item.packagingId}>
                      <td>{definition?.label ?? item.packagingId}</td>
                      <td>{`${formatNumber(onHand, 0)} / ${formatNumber(onHand * (definition?.unitWeightKg ?? 0), 1)} kg`}</td>
                      <td>
                        <input
                          className="input"
                          type="number"
                          min="0"
                          value={item.quantity}
                          onChange={(event) => updateItem(item.packagingId, Number(event.target.value) || 0)}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {message ? <div style={{ color: message === t('sales.deliverySaved') ? 'var(--accent-700)' : 'var(--danger)' }}>{message}</div> : null}

          <div className="control-row">
            <button className="btn primary" type="button" onClick={saveDispatch}>
              {t('sales.saveDelivery')}
            </button>
          </div>
        </div>

        <div className="card module-side-card">
          <div className="production-header-row">
            <strong>{t('sales.inventoryTitle')}</strong>
            <span className="muted">{t('sales.kpiOnHand')}</span>
          </div>
          <div className="module-summary-stack">
            {inventory.slice(0, 6).map((row) => (
              <div key={row.packagingId}>
                <span>{row.label}</span>
                <strong>{`${formatNumber(row.onHandCount, 0)} / ${formatNumber(row.onHandKg, 1)} kg`}</strong>
              </div>
            ))}
            {!inventory.length ? (
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
          <strong>{t('sales.deliveriesList')}</strong>
          <span className="muted">{filteredDispatches.length}</span>
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('daily.day')}</th>
                <th>{t('sales.customer')}</th>
                <th>{t('sales.items')}</th>
                <th>{t('sales.kpiSoldKg')}</th>
                <th>{t('suppliers.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {filteredDispatches.map((dispatch) => (
                <tr key={dispatch.id}>
                  <td>{dispatch.date}</td>
                  <td>{buildCustomerName(customers.find((item) => item.id === dispatch.customerId))}</td>
                  <td>{buildDispatchLabel(dispatch, activePackaging) || '-'}</td>
                  <td>{`${formatNumber(sumDispatchKg(dispatch, activePackaging), 1)} kg`}</td>
                  <td>
                    <button className="btn" type="button" onClick={() => removeDispatch(dispatch.id)}>
                      {t('common.delete')}
                    </button>
                  </td>
                </tr>
              ))}
              {!filteredDispatches.length ? (
                <tr>
                  <td colSpan={5}>{t('common.noData')}</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
