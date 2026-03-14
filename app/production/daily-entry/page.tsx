'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PeriodToolbar } from '@/components/production/period-toolbar';
import { fetchIntakeSnapshotsForMonth, findSnapshot } from '@/lib/production/intake';
import { useProductionStore } from '@/lib/production/store';
import { buildDate, buildProductionRows, formatNumber } from '@/lib/production/utils';
import { useTranslation } from '@/lib/i18n/use-translation';
import type { PackagingRecord, ProductionOutput, ProductionRecord } from '@/types/production';

function createDraft(date: string, outputs: ProductionOutput[], packaging: PackagingRecord[], averageFatUnit: number | null): ProductionRecord {
  return {
    date,
    carryoverMilkLiters: 0,
    milkWasteLiters: 0,
    averageFatUnit,
    note: '',
    outputs,
    packaging,
    updatedAt: new Date().toISOString(),
  };
}

function mergeDraft(
  date: string,
  outputs: ProductionOutput[],
  packaging: PackagingRecord[],
  averageFatUnit: number | null,
  savedRecord: ProductionRecord | null
): ProductionRecord {
  if (!savedRecord) return createDraft(date, outputs, packaging, averageFatUnit);

  return {
    ...savedRecord,
    date,
    averageFatUnit: savedRecord.averageFatUnit ?? averageFatUnit,
    outputs,
    packaging,
  };
}

export default function ProductionDailyEntryPage() {
  const now = new Date();
  const { t } = useTranslation();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [day, setDay] = useState(now.getDate());
  const products = useProductionStore((state) => state.products);
  const packagingDefinitions = useProductionStore((state) => state.packaging);
  const records = useProductionStore((state) => state.records);
  const upsertRecord = useProductionStore((state) => state.upsertRecord);

  const selectedDate = buildDate(year, month, day);
  const savedRecord = records[selectedDate] ?? null;

  const { data: snapshots = [], isLoading } = useQuery({
    queryKey: ['production-intake-day', year, month],
    queryFn: () => fetchIntakeSnapshotsForMonth(year, month),
  });

  const snapshot = useMemo(() => findSnapshot(snapshots, selectedDate), [selectedDate, snapshots]);
  const rowModel = useMemo(() => buildProductionRows(products, packagingDefinitions, savedRecord), [packagingDefinitions, products, savedRecord]);

  const [draft, setDraft] = useState<ProductionRecord>(() =>
    mergeDraft(
      selectedDate,
      rowModel.outputs.map((item) => item.output),
      rowModel.packaging.map((item) => item.row),
      snapshot.averageFatUnit,
      savedRecord
    )
  );

  useEffect(() => {
    const maxDay = new Date(year, month, 0).getDate();
    if (day > maxDay) {
      setDay(maxDay);
    }
  }, [day, month, year]);

  useEffect(() => {
    setDraft(
      mergeDraft(
        selectedDate,
        rowModel.outputs.map((item) => item.output),
        rowModel.packaging.map((item) => item.row),
        snapshot.averageFatUnit,
        savedRecord
      )
    );
  }, [rowModel, savedRecord, selectedDate, snapshot.averageFatUnit]);

  const processedMilkLiters = draft.outputs.reduce((sum, item) => sum + item.milkUsedLiters, 0);
  const producedKg = draft.outputs.reduce((sum, item) => sum + item.producedKg, 0);
  const productionWasteKg = draft.outputs.reduce((sum, item) => sum + item.wasteKg, 0);
  const packedKg = draft.packaging.reduce((sum, item) => {
    const definition = packagingDefinitions.find((packaging) => packaging.id === item.packagingId);
    return sum + (definition ? definition.unitWeightKg * item.packedCount : 0);
  }, 0);
  const milkBalance = snapshot.milkReceivedLiters - processedMilkLiters - draft.carryoverMilkLiters - draft.milkWasteLiters;
  const openStockKg = Math.max(producedKg - packedKg - productionWasteKg, 0);
  const averageYield = producedKg > 0 ? processedMilkLiters / producedKg : null;

  function updateOutput(productId: string, patch: Partial<ProductionOutput>) {
    setDraft((current) => ({
      ...current,
      outputs: current.outputs.map((item) => (item.productId === productId ? { ...item, ...patch } : item)),
    }));
  }

  function updatePackaging(packagingId: string, patch: Partial<PackagingRecord>) {
    setDraft((current) => ({
      ...current,
      packaging: current.packaging.map((item) => (item.packagingId === packagingId ? { ...item, ...patch } : item)),
    }));
  }

  function saveRecord() {
    upsertRecord(draft);
  }

  return (
    <div className="module-page">
      <div className="card module-hero-main">
        <div className="production-header-row">
          <div style={{ display: 'grid', gap: 6 }}>
            <h2 style={{ margin: 0 }}>{t('productionEntry.title')}</h2>
            <div className="muted">{t('productionEntry.subtitle')}</div>
          </div>
          <button className="btn primary" type="button" onClick={saveRecord}>
            {t('productionEntry.saveDay')}
          </button>
        </div>

        <PeriodToolbar
          period="day"
          year={year}
          month={month}
          day={day}
          disablePeriodChange
          onPeriodChange={() => undefined}
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
            <strong>{t('productionEntry.intakeSnapshot')}</strong>
            <span className="badge">{selectedDate}</span>
          </div>
          <div className="production-subgrid">
            <div className="production-inline-card">
              <div className="muted">{t('productionEntry.milkReceived')}</div>
              <strong>{isLoading ? t('common.loading') : `${formatNumber(snapshot.milkReceivedLiters, 0)} L`}</strong>
            </div>
            <div className="production-inline-card">
              <div className="muted">{t('productionEntry.avgFatUnit')}</div>
              <strong>{snapshot.averageFatUnit !== null ? formatNumber(snapshot.averageFatUnit, 2) : '-'}</strong>
            </div>
            <div className="production-inline-card">
              <div className="muted">{t('productionEntry.suppliersCount')}</div>
              <strong>{snapshot.supplierCount}</strong>
            </div>
          </div>

          <div className="module-form-grid">
            <label className="module-field">
              <span>{t('productionEntry.carryoverMilk')}</span>
              <input
                className="input"
                type="number"
                value={draft.carryoverMilkLiters}
                onChange={(event) => setDraft((current) => ({ ...current, carryoverMilkLiters: Number(event.target.value) || 0 }))}
              />
            </label>
            <label className="module-field">
              <span>{t('productionEntry.milkWaste')}</span>
              <input
                className="input"
                type="number"
                value={draft.milkWasteLiters}
                onChange={(event) => setDraft((current) => ({ ...current, milkWasteLiters: Number(event.target.value) || 0 }))}
              />
            </label>
            <label className="module-field">
              <span>{t('productionEntry.avgFatUnit')}</span>
              <input
                className="input"
                type="number"
                step="0.01"
                value={draft.averageFatUnit ?? ''}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    averageFatUnit: event.target.value === '' ? null : Number(event.target.value),
                  }))
                }
              />
            </label>
          </div>
        </div>

        <div className="card module-side-card">
          <div className="muted" style={{ fontSize: 12 }}>
            {t('productionEntry.dayClosure')}
          </div>
          <div className="module-summary-stack">
            <div>
              <span>{t('productionEntry.intakeBalance')}</span>
              <strong>{`${formatNumber(milkBalance, 1)} L`}</strong>
            </div>
            <div>
              <span>{t('productionEntry.packedKg')}</span>
              <strong>{`${formatNumber(packedKg, 1)} kg`}</strong>
            </div>
            <div>
              <span>{t('productionEntry.remainingKg')}</span>
              <strong>{`${formatNumber(openStockKg, 1)} kg`}</strong>
            </div>
            <div>
              <span>{t('productionEntry.avgMilkForKg')}</span>
              <strong>{averageYield !== null ? `${formatNumber(averageYield, 2)} L/kg` : '-'}</strong>
            </div>
          </div>
        </div>
      </div>

      <div className="card module-form-card">
        <div className="production-header-row">
          <strong>{t('productionEntry.processingOutputs')}</strong>
          <span className="muted">{t('productionEntry.liveIntake')}</span>
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('productionEntry.product')}</th>
                <th>{t('productionEntry.milkUsed')}</th>
                <th>{t('productionEntry.cheeseProduced')}</th>
                <th>{t('productionEntry.wasteKg')}</th>
                <th>{t('productionEntry.avgMilkForKg')}</th>
              </tr>
            </thead>
            <tbody>
              {draft.outputs.map((item) => {
                const product = products.find((productItem) => productItem.id === item.productId);
                const yieldValue = item.producedKg > 0 ? item.milkUsedLiters / item.producedKg : null;

                return (
                  <tr key={item.productId}>
                    <td>{product?.name ?? item.productId}</td>
                    <td>
                      <input
                        className="input"
                        type="number"
                        value={item.milkUsedLiters}
                        onChange={(event) => updateOutput(item.productId, { milkUsedLiters: Number(event.target.value) || 0 })}
                      />
                    </td>
                    <td>
                      <input
                        className="input"
                        type="number"
                        step="0.1"
                        value={item.producedKg}
                        onChange={(event) => updateOutput(item.productId, { producedKg: Number(event.target.value) || 0 })}
                      />
                    </td>
                    <td>
                      <input
                        className="input"
                        type="number"
                        step="0.1"
                        value={item.wasteKg}
                        onChange={(event) => updateOutput(item.productId, { wasteKg: Number(event.target.value) || 0 })}
                      />
                    </td>
                    <td>{yieldValue !== null ? `${formatNumber(yieldValue, 2)} L/kg` : '-'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card module-form-card">
        <div className="production-header-row">
          <strong>{t('productionEntry.packaging')}</strong>
          <span className="muted">{t('productionEntry.traceability')}</span>
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('productionProducts.packageLabel')}</th>
                <th>{t('productionEntry.unitWeight')}</th>
                <th>{t('productionEntry.packageCount')}</th>
                <th>{t('productionEntry.packedKg')}</th>
              </tr>
            </thead>
            <tbody>
              {draft.packaging.map((item) => {
                const definition = packagingDefinitions.find((packaging) => packaging.id === item.packagingId);
                const totalKg = (definition?.unitWeightKg ?? 0) * item.packedCount;

                return (
                  <tr key={item.packagingId}>
                    <td>{definition?.label ?? item.packagingId}</td>
                    <td>{definition ? `${formatNumber(definition.unitWeightKg, 1)} kg` : '-'}</td>
                    <td>
                      <input
                        className="input"
                        type="number"
                        value={item.packedCount}
                        onChange={(event) => updatePackaging(item.packagingId, { packedCount: Number(event.target.value) || 0 })}
                      />
                    </td>
                    <td>{`${formatNumber(totalKg, 1)} kg`}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <label className="module-field">
          <span>{t('productionEntry.productionNote')}</span>
          <textarea
            className="input"
            style={{ minHeight: 88 }}
            value={draft.note}
            onChange={(event) => setDraft((current) => ({ ...current, note: event.target.value }))}
          />
        </label>
      </div>
    </div>
  );
}
