'use client';

import { useMemo, useRef, useState, useEffect, useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as XLSX from 'xlsx';
import { localeForLanguage } from '@/lib/i18n/locale';
import { useTranslation } from '@/lib/i18n/use-translation';
import type { DailyEntry, Supplier } from '@/types/domain';

type Period = 'FIRST_HALF' | 'SECOND_HALF' | 'FULL';

type QualityDraftRow = {
  id?: number;
  date: string;
  fat_pct: string;
};

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function toDate(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function getDefaultPeriod(dayOfMonth: number): Period {
  return dayOfMonth <= 15 ? 'FIRST_HALF' : 'SECOND_HALF';
}

async function fetchSuppliers(): Promise<Supplier[]> {
  const response = await fetch('/api/suppliers');
  if (!response.ok) throw new Error('Failed to fetch suppliers');
  const data = (await response.json()) as Supplier[];
  return data.sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));
}

async function fetchEntries(year: number, month: number): Promise<DailyEntry[]> {
  const response = await fetch(`/api/daily-entries?year=${year}&month=${month}`);
  if (!response.ok) throw new Error('Failed to fetch daily entries');
  return response.json();
}

export default function DailyEntryPage() {
  const now = new Date();
  const { t, language } = useTranslation();
  const locale = localeForLanguage(language);

  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [period, setPeriod] = useState<Period>(getDefaultPeriod(now.getDate()));
  const [changes, setChanges] = useState<Record<string, string>>({});

  const [qualitySupplier, setQualitySupplier] = useState<Supplier | null>(null);
  const [qualityRows, setQualityRows] = useState<QualityDraftRow[]>([]);

  const queryClient = useQueryClient();

  const { data: suppliers = [], isLoading: suppliersLoading } = useQuery({
    queryKey: ['suppliers'],
    queryFn: fetchSuppliers,
  });

  const { data: entries = [], isLoading: entriesLoading } = useQuery({
    queryKey: ['entries', year, month],
    queryFn: () => fetchEntries(year, month),
  });

  const isLoading = suppliersLoading || entriesLoading;

  useEffect(() => {
    setChanges({});
  }, [year, month]);

  const dayNumbers = useMemo(() => {
    const total = daysInMonth(year, month);
    if (period === 'FIRST_HALF') return Array.from({ length: Math.min(15, total) }, (_, i) => i + 1);
    if (period === 'SECOND_HALF') return Array.from({ length: Math.max(total - 15, 0) }, (_, i) => i + 16);
    return Array.from({ length: total }, (_, i) => i + 1);
  }, [year, month, period]);

  const originalQtyMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of entries) {
      const day = Number(item.date.slice(8, 10));
      map.set(`${item.supplier_id}_${day}`, Number(item.qty ?? 0));
    }
    return map;
  }, [entries]);

  const fatMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of entries) {
      const day = Number(item.date.slice(8, 10));
      if (item.fat_pct !== null && item.fat_pct !== undefined) {
        map.set(`${item.supplier_id}_${day}`, item.fat_pct);
      }
    }
    return map;
  }, [entries]);

  const getCellValue = useCallback((supplierId: number, day: number): number => {
    const key = `${supplierId}_${day}`;
    if (changes[key] !== undefined) {
      const parsed = Number(changes[key]);
      return Number.isFinite(parsed) ? parsed : 0;
    }
    return originalQtyMap.get(key) ?? 0;
  }, [changes, originalQtyMap]);

  function setCellValue(supplierId: number, day: number, value: string) {
    const key = `${supplierId}_${day}`;
    setChanges((prev) => ({ ...prev, [key]: value }));
  }

  const { rowTotals, colTotals, grandTotal } = useMemo(() => {
    const rowTotals: Record<number, number> = {};
    const colTotals: Record<number, number> = {};
    let grand = 0;

    for (const supplier of suppliers) {
      let row = 0;
      for (const day of dayNumbers) {
        const value = getCellValue(supplier.id, day);
        row += value;
        colTotals[day] = (colTotals[day] ?? 0) + value;
      }
      rowTotals[supplier.id] = row;
      grand += row;
    }

    return { rowTotals, colTotals, grandTotal: grand };
  }, [suppliers, dayNumbers, getCellValue]);

  function averageFatForSupplier(supplierId: number): string {
    const values = dayNumbers
      .map((day) => fatMap.get(`${supplierId}_${day}`))
      .filter((x): x is number => x !== undefined);

    if (!values.length) return '';
    const avg = values.reduce((sum, v) => sum + v, 0) / values.length;
    return avg.toFixed(2);
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload: Array<{ date: string; qty: number; supplierId: number }> = [];

      for (const [key, raw] of Object.entries(changes)) {
        const [supplierIdText, dayText] = key.split('_');
        const supplierId = Number(supplierIdText);
        const day = Number(dayText);
        const nextValue = Number(raw);
        const currentValue = originalQtyMap.get(key) ?? 0;

        if (!Number.isFinite(nextValue) || nextValue < 0) continue;
        if (nextValue === currentValue) continue;

        payload.push({
          supplierId,
          date: toDate(year, month, day),
          qty: nextValue,
        });
      }

      if (!payload.length) return;

      const response = await fetch('/api/daily-entries/bulk-upsert', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) throw new Error('Failed to save changes');
      return response.json();
    },
    onSuccess: async () => {
      setChanges({});
      await queryClient.invalidateQueries({ queryKey: ['entries', year, month] });
    },
  });

  const unsavedWarning = t('daily.unsavedWarning');
  useEffect(() => {
    const hasUnsaved = Object.keys(changes).length > 0;
    const handler = (event: BeforeUnloadEvent) => {
      if (!hasUnsaved) return;
      event.preventDefault();
      event.returnValue = unsavedWarning;
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [changes, unsavedWarning]);

  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  function focusCell(row: number, col: number) {
    const ref = inputRefs.current[`${row}_${col}`];
    ref?.focus();
    ref?.select();
  }

  function onCellKeyDown(
    event: React.KeyboardEvent<HTMLInputElement>,
    row: number,
    col: number
  ) {
    const maxRow = suppliers.length - 1;
    const maxCol = dayNumbers.length - 1;

    if (event.key === 'Tab' && event.shiftKey) {
      if (col > 0) {
        event.preventDefault();
        focusCell(row, col - 1);
      }
      return;
    }

    if (event.key === 'Enter' && event.shiftKey) {
      event.preventDefault();
      if (row > 0) focusCell(row - 1, col);
      return;
    }

    if (event.key === 'ArrowRight' || event.key === 'Tab') {
      if (col < maxCol) {
        event.preventDefault();
        focusCell(row, col + 1);
      }
      return;
    }

    if (event.key === 'ArrowLeft') {
      if (col > 0) {
        event.preventDefault();
        focusCell(row, col - 1);
      }
      return;
    }

    if (event.key === 'ArrowDown' || event.key === 'Enter') {
      event.preventDefault();
      if (row < maxRow) focusCell(row + 1, col);
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (row > 0) focusCell(row - 1, col);
    }
  }

  function openQualityEditor(supplier: Supplier) {
    setQualitySupplier(supplier);

    const baseRows = entries
      .filter((item) => item.supplier_id === supplier.id && item.fat_pct !== null)
      .map((item) => ({ id: item.id, date: item.date, fat_pct: String(item.fat_pct ?? '') }))
      .sort((a, b) => a.date.localeCompare(b.date));

    setQualityRows(baseRows);
  }

  const qualityMutation = useMutation({
    mutationFn: async () => {
      if (!qualitySupplier) return;

      const existing = entries.filter((item) => item.supplier_id === qualitySupplier.id && item.fat_pct !== null);
      const existingIds = new Set(existing.map((item) => item.id));
      const finalIds = new Set(qualityRows.filter((item) => item.id).map((item) => item.id as number));

      const deleteIds = [...existingIds].filter((id) => !finalIds.has(id));
      for (const id of deleteIds) {
        const response = await fetch(`/api/daily-entries/${id}`, { method: 'DELETE' });
        if (!response.ok) throw new Error('Failed to delete quality record');
      }

      for (const row of qualityRows) {
        const fat = Number(row.fat_pct);
        if (!row.date || !Number.isFinite(fat) || fat < 0) continue;

        const response = await fetch('/api/daily-entries/upsert', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            date: row.date,
            supplierId: qualitySupplier.id,
            fat_pct: fat,
          }),
        });

        if (!response.ok) throw new Error('Failed to upsert quality record');
      }
    },
    onSuccess: async () => {
      setQualitySupplier(null);
      setQualityRows([]);
      await queryClient.invalidateQueries({ queryKey: ['entries', year, month] });
    },
  });

  function exportXlsx() {
    const rows: (string | number)[][] = [];
    rows.push([t('daily.supplier'), ...dayNumbers.map((d) => String(d)), t('daily.total'), t('daily.avgMm')]);

    for (const supplier of suppliers) {
      rows.push([
        `${supplier.first_name} ${supplier.last_name}`,
        ...dayNumbers.map((d) => getCellValue(supplier.id, d)),
        rowTotals[supplier.id] ?? 0,
        averageFatForSupplier(supplier.id),
      ]);
    }

    rows.push([
      t('daily.columnTotals'),
      ...dayNumbers.map((d) => Number((colTotals[d] ?? 0).toFixed(2))),
      Number(grandTotal.toFixed(2)),
      '',
    ]);

    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, t('nav.daily'));
    XLSX.writeFile(wb, `daily_intake_${year}_${month}.xlsx`);
  }

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div className="card" style={{ padding: 12, display: 'grid', gap: 10 }}>
        <div className="control-row" style={{ justifyContent: 'space-between' }}>
          <h2 style={{ margin: 0 }}>{t('daily.title')}</h2>
          <div className="badge">{t('daily.keyboardMode')}</div>
        </div>

        <div className="control-row">
          <label className="muted">{t('daily.year')}</label>
          <select className="input" value={year} onChange={(e) => setYear(Number(e.target.value))}>
            {Array.from({ length: 6 }, (_, i) => now.getFullYear() - 2 + i).map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>

          <label className="muted">{t('daily.month')}</label>
          <select className="input" value={month} onChange={(e) => setMonth(Number(e.target.value))}>
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <option key={m} value={m}>
                {new Date(year, m - 1, 1).toLocaleDateString(locale, { month: 'long' })}
              </option>
            ))}
          </select>

          <label className="muted">{t('daily.period')}</label>
          <select className="input" value={period} onChange={(e) => setPeriod(e.target.value as Period)}>
            <option value="FIRST_HALF">{t('daily.periodFirst')}</option>
            <option value="SECOND_HALF">{t('daily.periodSecond')}</option>
            <option value="FULL">{t('daily.periodFull')}</option>
          </select>

          <button className="btn" onClick={exportXlsx}>
            {t('common.exportXlsx')}
          </button>

          <button className="btn" onClick={() => setChanges({})}>
            {t('daily.discard')}
          </button>

          <button className="btn primary" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? t('daily.saving') : t('daily.saveAll')}
          </button>
        </div>
      </div>

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>{t('daily.supplier')}</th>
              {dayNumbers.map((day) => (
                <th key={day}>{day}</th>
              ))}
              <th>{t('daily.total')}</th>
              <th>{t('daily.avgMm')}</th>
              <th>{t('daily.quality')}</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={dayNumbers.length + 4}>{t('common.loading')}</td>
              </tr>
            ) : suppliers.length === 0 ? (
              <tr>
                <td colSpan={dayNumbers.length + 4}>{t('daily.noSuppliers')}</td>
              </tr>
            ) : (
              suppliers.map((supplier, rowIndex) => (
                <tr key={supplier.id}>
                  <td>
                    {supplier.first_name} {supplier.last_name}
                  </td>
                  {dayNumbers.map((day, colIndex) => {
                    const cellKey = `${supplier.id}_${day}`;
                    const hasFat = fatMap.has(cellKey);
                    const value = changes[cellKey] ?? String(getCellValue(supplier.id, day));

                    return (
                      <td key={day} style={{ background: hasFat ? '#fffbeb' : 'white' }}>
                        <input
                          ref={(el) => {
                            inputRefs.current[`${rowIndex}_${colIndex}`] = el;
                          }}
                          className="input"
                          style={{ width: 64, textAlign: 'right', padding: '6px 8px' }}
                          value={value}
                          onChange={(e) => setCellValue(supplier.id, day, e.target.value)}
                          onFocus={(e) => e.target.select()}
                          onKeyDown={(e) => onCellKeyDown(e, rowIndex, colIndex)}
                        />
                        {hasFat ? (
                          <div className="muted" style={{ fontSize: 11, marginTop: 3 }}>
                            {fatMap.get(cellKey)?.toFixed(1)}
                          </div>
                        ) : null}
                      </td>
                    );
                  })}
                  <td style={{ fontWeight: 600 }}>{(rowTotals[supplier.id] ?? 0).toFixed(2)}</td>
                  <td>{averageFatForSupplier(supplier.id)}</td>
                  <td>
                    <button className="btn" onClick={() => openQualityEditor(supplier)}>
                      {t('daily.editMm')}
                    </button>
                  </td>
                </tr>
              ))
            )}
            {suppliers.length > 0 ? (
              <tr style={{ background: '#f8fafc' }}>
                <td style={{ fontWeight: 700 }}>{t('daily.totals')}</td>
                {dayNumbers.map((day) => (
                  <td key={day} style={{ fontWeight: 700 }}>
                    {(colTotals[day] ?? 0).toFixed(2)}
                  </td>
                ))}
                <td style={{ fontWeight: 700 }}>{grandTotal.toFixed(2)}</td>
                <td />
                <td />
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {qualitySupplier ? (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.25)',
            display: 'grid',
            placeItems: 'center',
            zIndex: 20,
          }}
          onClick={() => {
            if (!qualityMutation.isPending) {
              setQualitySupplier(null);
              setQualityRows([]);
            }
          }}
        >
          <div className="card" style={{ width: 560, maxWidth: '92vw', padding: 12 }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>
              {t('daily.qualityTitle')} - {qualitySupplier.first_name} {qualitySupplier.last_name}
            </h3>

            <div style={{ display: 'grid', gap: 8, maxHeight: 320, overflow: 'auto' }}>
              {qualityRows.map((row, index) => (
                <div className="control-row" key={`${row.id ?? 'new'}-${index}`}>
                  <input
                    className="input"
                    type="date"
                    value={row.date}
                    onChange={(e) => {
                      const next = [...qualityRows];
                      next[index] = { ...next[index], date: e.target.value };
                      setQualityRows(next);
                    }}
                  />
                  <input
                    className="input"
                    type="number"
                    step="0.1"
                    value={row.fat_pct}
                    onChange={(e) => {
                      const next = [...qualityRows];
                      next[index] = { ...next[index], fat_pct: e.target.value };
                      setQualityRows(next);
                    }}
                  />
                  <button
                    className="btn danger"
                    onClick={() => setQualityRows((prev) => prev.filter((_, i) => i !== index))}
                  >
                    {t('common.remove')}
                  </button>
                </div>
              ))}
            </div>

            <div className="control-row" style={{ marginTop: 10, justifyContent: 'space-between' }}>
              <button
                className="btn"
                onClick={() =>
                  setQualityRows((prev) => [
                    ...prev,
                    { date: toDate(year, month, dayNumbers[0] ?? 1), fat_pct: '3.8' },
                  ])
                }
              >
                {t('daily.addQuality')}
              </button>
              <div className="control-row">
                <button
                  className="btn"
                  onClick={() => {
                    setQualitySupplier(null);
                    setQualityRows([]);
                  }}
                >
                  {t('common.cancel')}
                </button>
                <button
                  className="btn primary"
                  onClick={() => qualityMutation.mutate()}
                  disabled={qualityMutation.isPending}
                >
                  {qualityMutation.isPending ? t('common.saving') : t('daily.saveQuality')}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
