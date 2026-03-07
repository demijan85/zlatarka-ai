'use client';

import { useMemo, useRef, useState, useEffect, useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as XLSX from 'xlsx';
import { localeForLanguage } from '@/lib/i18n/locale';
import { useTranslation } from '@/lib/i18n/use-translation';
import { yearMonthFrom } from '@/lib/utils/year-month';
import type { DailyEntry, DailyIntakeLock, Supplier } from '@/types/domain';

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

async function responseError(response: Response, fallback: string): Promise<Error> {
  try {
    const parsed = (await response.json()) as { error?: string };
    if (parsed.error) return new Error(parsed.error);
  } catch {
    // ignore non-json response
  }

  return new Error(fallback);
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

async function fetchLockStatus(year: number, month: number): Promise<DailyIntakeLock> {
  const response = await fetch(`/api/daily-entries/lock?year=${year}&month=${month}`);
  if (!response.ok) throw new Error('Failed to fetch month lock status');
  return response.json();
}

export default function DailyEntryPage() {
  const now = new Date();
  const { t, language } = useTranslation();
  const locale = localeForLanguage(language);

  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [period, setPeriod] = useState<Period>(getDefaultPeriod(now.getDate()));
  const [selectedDay, setSelectedDay] = useState(now.getDate());
  const [changes, setChanges] = useState<Record<string, string>>({});
  const [actionError, setActionError] = useState('');
  const [actionInfo, setActionInfo] = useState('');

  const [qualitySupplier, setQualitySupplier] = useState<Supplier | null>(null);
  const [qualityRows, setQualityRows] = useState<QualityDraftRow[]>([]);
  const [correctionModalOpen, setCorrectionModalOpen] = useState(false);
  const [correctionDraft, setCorrectionDraft] = useState<{
    supplierId: number;
    day: number;
    fieldName: 'qty' | 'fat_pct';
    requestedValue: string;
    reason: string;
  }>({
    supplierId: 0,
    day: now.getDate(),
    fieldName: 'qty',
    requestedValue: '',
    reason: '',
  });

  const queryClient = useQueryClient();

  const { data: suppliers = [], isLoading: suppliersLoading } = useQuery({
    queryKey: ['suppliers'],
    queryFn: fetchSuppliers,
  });

  const { data: entries = [], isLoading: entriesLoading } = useQuery({
    queryKey: ['entries', year, month],
    queryFn: () => fetchEntries(year, month),
  });

  const { data: lockStatus, isLoading: lockLoading } = useQuery({
    queryKey: ['daily-lock', year, month],
    queryFn: () => fetchLockStatus(year, month),
  });

  const isLoading = suppliersLoading || entriesLoading;
  const yearMonth = useMemo(() => yearMonthFrom(year, month), [year, month]);
  const isLocked = lockStatus?.isLocked ?? false;
  const editingDisabled = isLocked || lockLoading;

  useEffect(() => {
    setChanges({});
    setActionError('');
    setActionInfo('');
  }, [year, month]);

  useEffect(() => {
    if (isLocked) {
      setQualitySupplier(null);
      setQualityRows([]);
      setChanges({});
    }
  }, [isLocked]);

  const dayNumbers = useMemo(() => {
    const total = daysInMonth(year, month);
    if (period === 'FIRST_HALF') return Array.from({ length: Math.min(15, total) }, (_, i) => i + 1);
    if (period === 'SECOND_HALF') return Array.from({ length: Math.max(total - 15, 0) }, (_, i) => i + 16);
    return Array.from({ length: total }, (_, i) => i + 1);
  }, [year, month, period]);

  useEffect(() => {
    if (!dayNumbers.length) return;
    if (!dayNumbers.includes(selectedDay)) {
      setSelectedDay(dayNumbers[0]);
    }
  }, [dayNumbers, selectedDay]);

  useEffect(() => {
    if (!suppliers.length) return;
    setCorrectionDraft((prev) => ({
      ...prev,
      supplierId: prev.supplierId > 0 ? prev.supplierId : suppliers[0].id,
      day: dayNumbers.includes(prev.day) ? prev.day : dayNumbers[0],
    }));
  }, [suppliers, dayNumbers]);

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

  const getCellValue = useCallback(
    (supplierId: number, day: number): number => {
      const key = `${supplierId}_${day}`;
      if (changes[key] !== undefined) {
        const parsed = Number(changes[key]);
        return Number.isFinite(parsed) ? parsed : 0;
      }
      return originalQtyMap.get(key) ?? 0;
    },
    [changes, originalQtyMap]
  );

  function setCellValue(supplierId: number, day: number, value: string) {
    if (editingDisabled) return;
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
      if (editingDisabled) throw new Error(t('daily.editBlocked'));

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

      if (!response.ok) throw await responseError(response, 'Failed to save changes');
      return response.json();
    },
    onSuccess: async () => {
      setActionError('');
      setChanges({});
      await queryClient.invalidateQueries({ queryKey: ['entries', year, month] });
      await queryClient.invalidateQueries({ queryKey: ['daily-lock', year, month] });
    },
    onError: (error) => {
      setActionError(error instanceof Error ? error.message : t('daily.editBlocked'));
    },
  });

  const lockMutation = useMutation({
    mutationFn: async (nextLocked: boolean) => {
      const response = await fetch('/api/daily-entries/lock', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          yearMonth,
          isLocked: nextLocked,
        }),
      });

      if (!response.ok) throw await responseError(response, t('daily.lockActionFailed'));
      return response.json() as Promise<DailyIntakeLock>;
    },
    onSuccess: async (_data, nextLocked) => {
      setActionError('');
      if (nextLocked) {
        setChanges({});
        setQualitySupplier(null);
        setQualityRows([]);
      }
      await queryClient.invalidateQueries({ queryKey: ['daily-lock', year, month] });
      await queryClient.invalidateQueries({ queryKey: ['entries', year, month] });
    },
    onError: (error) => {
      setActionError(error instanceof Error ? error.message : t('daily.lockActionFailed'));
    },
  });

  const unsavedWarning = t('daily.unsavedWarning');
  useEffect(() => {
    const hasUnsaved = Object.keys(changes).length > 0;
    const handler = (event: BeforeUnloadEvent) => {
      if (!hasUnsaved || editingDisabled) return;
      event.preventDefault();
      event.returnValue = unsavedWarning;
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [changes, unsavedWarning, editingDisabled]);

  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const mobileInputRefs = useRef<Record<number, HTMLInputElement | null>>({});

  function focusCell(row: number, col: number) {
    const ref = inputRefs.current[`${row}_${col}`];
    ref?.focus();
    ref?.select();
  }

  function onCellKeyDown(event: React.KeyboardEvent<HTMLInputElement>, row: number, col: number) {
    if (editingDisabled) return;

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

  function focusMobileInput(index: number) {
    const ref = mobileInputRefs.current[index];
    ref?.focus();
    ref?.select();
  }

  function onMobileInputKeyDown(event: React.KeyboardEvent<HTMLInputElement>, row: number) {
    if (editingDisabled) return;

    const maxRow = suppliers.length - 1;

    if (event.key === 'ArrowDown' || event.key === 'Enter') {
      event.preventDefault();
      if (row < maxRow) focusMobileInput(row + 1);
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (row > 0) focusMobileInput(row - 1);
    }
  }

  function openQualityEditor(supplier: Supplier) {
    if (editingDisabled) return;

    setQualitySupplier(supplier);

    const baseRows = entries
      .filter((item) => item.supplier_id === supplier.id && item.fat_pct !== null)
      .map((item) => ({ id: item.id, date: item.date, fat_pct: String(item.fat_pct ?? '') }))
      .sort((a, b) => a.date.localeCompare(b.date));

    setQualityRows(baseRows);
  }

  const qualityMutation = useMutation({
    mutationFn: async () => {
      if (editingDisabled) throw new Error(t('daily.editBlocked'));
      if (!qualitySupplier) return;

      const existing = entries.filter((item) => item.supplier_id === qualitySupplier.id && item.fat_pct !== null);
      const existingIds = new Set(existing.map((item) => item.id));
      const finalIds = new Set(qualityRows.filter((item) => item.id).map((item) => item.id as number));

      const deleteIds = [...existingIds].filter((id) => !finalIds.has(id));
      for (const id of deleteIds) {
        const response = await fetch(`/api/daily-entries/${id}`, { method: 'DELETE' });
        if (!response.ok) throw await responseError(response, 'Failed to delete quality record');
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

        if (!response.ok) throw await responseError(response, 'Failed to upsert quality record');
      }
    },
    onSuccess: async () => {
      setActionError('');
      setQualitySupplier(null);
      setQualityRows([]);
      await queryClient.invalidateQueries({ queryKey: ['entries', year, month] });
      await queryClient.invalidateQueries({ queryKey: ['daily-lock', year, month] });
    },
    onError: (error) => {
      setActionError(error instanceof Error ? error.message : t('daily.editBlocked'));
    },
  });

  const correctionMutation = useMutation({
    mutationFn: async () => {
      if (!isLocked) throw new Error('Corrections are for locked months');
      if (!correctionDraft.supplierId) throw new Error('Supplier is required');
      const requestedValue = Number(correctionDraft.requestedValue);
      if (!Number.isFinite(requestedValue) || requestedValue < 0) {
        throw new Error('Invalid requested value');
      }
      if (correctionDraft.fieldName === 'fat_pct' && requestedValue > 20) {
        throw new Error('Quality value cannot be greater than 20');
      }
      if (!correctionDraft.reason.trim()) throw new Error('Reason is required');

      const response = await fetch('/api/corrections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          yearMonth,
          supplierId: correctionDraft.supplierId,
          entryDate: toDate(year, month, correctionDraft.day),
          fieldName: correctionDraft.fieldName,
          requestedValue,
          reason: correctionDraft.reason,
        }),
      });

      if (!response.ok) throw await responseError(response, 'Failed to submit correction request');
      return response.json();
    },
    onSuccess: async () => {
      setActionError('');
      setActionInfo(t('daily.correctionRequested'));
      setCorrectionModalOpen(false);
      setCorrectionDraft((prev) => ({ ...prev, requestedValue: '', reason: '' }));
      await queryClient.invalidateQueries({ queryKey: ['corrections'] });
    },
    onError: (error) => {
      setActionInfo('');
      setActionError(error instanceof Error ? error.message : 'Failed to submit correction request');
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

  function toggleMonthLock() {
    const hasUnsaved = Object.keys(changes).length > 0;
    if (!isLocked && hasUnsaved) {
      const confirmedUnsaved = confirm(t('daily.confirmLockUnsaved'));
      if (!confirmedUnsaved) return;
    }

    const confirmed = confirm(isLocked ? t('daily.confirmUnlock') : t('daily.confirmLock'));
    if (!confirmed) return;

    lockMutation.mutate(!isLocked);
  }

  function moveSelectedDay(offset: number) {
    if (!dayNumbers.length) return;
    const currentIndex = dayNumbers.indexOf(selectedDay);
    const safeCurrentIndex = currentIndex >= 0 ? currentIndex : 0;
    const nextIndex = Math.min(dayNumbers.length - 1, Math.max(0, safeCurrentIndex + offset));
    setSelectedDay(dayNumbers[nextIndex]);
  }

  return (
    <div className="daily-entry-page" style={{ display: 'grid', gap: 12 }}>
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

          <button className="btn" onClick={() => setChanges({})} disabled={editingDisabled || saveMutation.isPending}>
            {t('daily.discard')}
          </button>

          <button
            className="btn primary"
            onClick={() => saveMutation.mutate()}
            disabled={editingDisabled || saveMutation.isPending}
          >
            {saveMutation.isPending ? t('daily.saving') : t('daily.saveAll')}
          </button>
        </div>

        <div className="control-row" style={{ justifyContent: 'space-between' }}>
          <div className="control-row">
            <span className="muted">{t('daily.lockStatus')}:</span>
            <span className="badge" style={isLocked ? { background: '#fee2e2', color: '#b91c1c' } : undefined}>
              {isLocked ? t('daily.locked') : t('daily.unlocked')}
            </span>
            <span className="muted" style={{ fontSize: 12 }}>
              {yearMonth}
            </span>
          </div>

          <button className="btn" onClick={toggleMonthLock} disabled={lockLoading || lockMutation.isPending}>
            {lockMutation.isPending ? t('common.saving') : isLocked ? t('daily.unlockMonth') : t('daily.lockMonth')}
          </button>
          <button
            className="btn"
            onClick={() => setCorrectionModalOpen(true)}
            disabled={!isLocked || suppliers.length === 0 || correctionMutation.isPending}
          >
            {t('daily.requestCorrection')}
          </button>
        </div>

        {isLocked ? <div className="muted">{t('daily.lockedReadonly')}</div> : null}
        {actionError ? <div style={{ color: 'var(--danger)', fontSize: 13 }}>{actionError}</div> : null}
        {actionInfo ? <div style={{ color: 'var(--primary)', fontSize: 13 }}>{actionInfo}</div> : null}
      </div>

      <div className="daily-mobile-entry">
        <div className="card" style={{ padding: 12, display: 'grid', gap: 10 }}>
          <div className="control-row" style={{ justifyContent: 'space-between' }}>
            <div className="control-row">
              <button className="btn" onClick={() => moveSelectedDay(-1)} disabled={selectedDay === dayNumbers[0]}>
                ‹
              </button>
              <label className="muted">{t('daily.day')}</label>
              <select className="input" value={selectedDay} onChange={(e) => setSelectedDay(Number(e.target.value))}>
                {dayNumbers.map((day) => (
                  <option key={day} value={day}>
                    {day}
                  </option>
                ))}
              </select>
              <button
                className="btn"
                onClick={() => moveSelectedDay(1)}
                disabled={dayNumbers.length === 0 || selectedDay === dayNumbers[dayNumbers.length - 1]}
              >
                ›
              </button>
            </div>

            <div className="muted" style={{ fontSize: 12 }}>
              {t('daily.dayTotal')}: <strong>{(colTotals[selectedDay] ?? 0).toFixed(2)}</strong>
            </div>
          </div>

          <div className="muted" style={{ fontSize: 12 }}>
            {t('daily.mobileHint')}
          </div>
        </div>

        <div className="card" style={{ padding: 0 }}>
          {isLoading ? (
            <div style={{ padding: 12 }} className="muted">
              {t('common.loading')}
            </div>
          ) : suppliers.length === 0 ? (
            <div style={{ padding: 12 }} className="muted">
              {t('daily.noSuppliers')}
            </div>
          ) : (
            <div>
              {suppliers.map((supplier, rowIndex) => {
                const cellKey = `${supplier.id}_${selectedDay}`;
                const hasFat = fatMap.has(cellKey);
                const value = changes[cellKey] ?? String(getCellValue(supplier.id, selectedDay));

                return (
                  <div key={supplier.id} className="daily-mobile-row">
                    <div>
                      <div className="daily-mobile-name">
                        {supplier.first_name} {supplier.last_name}
                      </div>
                      <div className="daily-mobile-meta">
                        {t('daily.total')}: {(rowTotals[supplier.id] ?? 0).toFixed(2)}
                        {hasFat ? ` | ${t('monthly.mm')}: ${fatMap.get(cellKey)?.toFixed(1)}` : ''}
                      </div>
                    </div>

                    <input
                      ref={(el) => {
                        mobileInputRefs.current[rowIndex] = el;
                      }}
                      className="input daily-mobile-input"
                      value={value}
                      disabled={editingDisabled}
                      onChange={(e) => setCellValue(supplier.id, selectedDay, e.target.value)}
                      onFocus={(e) => e.target.select()}
                      onKeyDown={(e) => onMobileInputKeyDown(e, rowIndex)}
                    />

                    <button className="btn" onClick={() => openQualityEditor(supplier)} disabled={editingDisabled}>
                      {t('daily.editMm')}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="table-wrap daily-desktop-grid">
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
                          disabled={editingDisabled}
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
                    <button className="btn" onClick={() => openQualityEditor(supplier)} disabled={editingDisabled}>
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
                    disabled={editingDisabled}
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
                    disabled={editingDisabled}
                    onChange={(e) => {
                      const next = [...qualityRows];
                      next[index] = { ...next[index], fat_pct: e.target.value };
                      setQualityRows(next);
                    }}
                  />
                  <button
                    className="btn danger"
                    disabled={editingDisabled}
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
                disabled={editingDisabled}
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
                  disabled={editingDisabled || qualityMutation.isPending}
                >
                  {qualityMutation.isPending ? t('common.saving') : t('daily.saveQuality')}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {correctionModalOpen ? (
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
            if (!correctionMutation.isPending) setCorrectionModalOpen(false);
          }}
        >
          <div className="card" style={{ width: 560, maxWidth: '92vw', padding: 12, display: 'grid', gap: 10 }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: 0 }}>{t('daily.correctionTitle')}</h3>

            <div className="control-row">
              <label className="muted">{t('daily.supplier')}</label>
              <select
                className="input"
                value={correctionDraft.supplierId}
                onChange={(e) => setCorrectionDraft((prev) => ({ ...prev, supplierId: Number(e.target.value) }))}
              >
                {suppliers.map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.first_name} {supplier.last_name}
                  </option>
                ))}
              </select>

              <label className="muted">{t('daily.day')}</label>
              <select
                className="input"
                value={correctionDraft.day}
                onChange={(e) => setCorrectionDraft((prev) => ({ ...prev, day: Number(e.target.value) }))}
              >
                {dayNumbers.map((day) => (
                  <option key={day} value={day}>
                    {day}
                  </option>
                ))}
              </select>
            </div>

            <div className="control-row">
              <label className="muted">{t('daily.correctionField')}</label>
              <select
                className="input"
                value={correctionDraft.fieldName}
                onChange={(e) =>
                  setCorrectionDraft((prev) => ({
                    ...prev,
                    fieldName: e.target.value as 'qty' | 'fat_pct',
                  }))
                }
              >
                <option value="qty">{t('monthly.qty')}</option>
                <option value="fat_pct">{t('monthly.mm')}</option>
              </select>

              <label className="muted">{t('daily.correctionCurrentValue')}</label>
              <input
                className="input"
                value={
                  correctionDraft.fieldName === 'qty'
                    ? String(getCellValue(correctionDraft.supplierId, correctionDraft.day))
                    : String(fatMap.get(`${correctionDraft.supplierId}_${correctionDraft.day}`) ?? '')
                }
                disabled
              />

              <label className="muted">{t('daily.correctionNewValue')}</label>
              <input
                className="input"
                type="number"
                step={correctionDraft.fieldName === 'qty' ? '1' : '0.1'}
                value={correctionDraft.requestedValue}
                onChange={(e) => setCorrectionDraft((prev) => ({ ...prev, requestedValue: e.target.value }))}
              />
            </div>

            <textarea
              className="input"
              style={{ minHeight: 80 }}
              placeholder={t('daily.correctionReason')}
              value={correctionDraft.reason}
              onChange={(e) => setCorrectionDraft((prev) => ({ ...prev, reason: e.target.value }))}
            />

            <div className="control-row" style={{ justifyContent: 'flex-end' }}>
              <button className="btn" onClick={() => setCorrectionModalOpen(false)} disabled={correctionMutation.isPending}>
                {t('common.cancel')}
              </button>
              <button className="btn primary" onClick={() => correctionMutation.mutate()} disabled={correctionMutation.isPending}>
                {correctionMutation.isPending ? t('common.saving') : t('daily.correctionSubmit')}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="daily-mobile-actions">
        <button className="btn" onClick={() => setChanges({})} disabled={editingDisabled || saveMutation.isPending}>
          {t('daily.discard')}
        </button>
        <button className="btn primary" onClick={() => saveMutation.mutate()} disabled={editingDisabled || saveMutation.isPending}>
          {saveMutation.isPending ? t('daily.saving') : t('daily.saveAll')}
        </button>
      </div>
    </div>
  );
}
