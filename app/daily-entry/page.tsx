'use client';

import { useMemo, useRef, useState, useEffect, useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Droplets, FileSpreadsheet, UserPlus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import * as XLSX from 'xlsx';
import { ConfirmDialog } from '@/components/layout/confirm-dialog';
import { useNavigationGuard } from '@/components/layout/navigation-guard';
import { inputLocaleForLanguage, localeForLanguage } from '@/lib/i18n/locale';
import { useTranslation } from '@/lib/i18n/use-translation';
import { formatIsoDateForLocale } from '@/lib/utils/date';
import { yearMonthFrom } from '@/lib/utils/year-month';
import type { DailyEntry, DailyIntakeLock, Supplier } from '@/types/domain';

type Period = 'FIRST_HALF' | 'SECOND_HALF' | 'FULL';

type QualityDraftRow = {
  id?: number;
  date: string;
  fat_pct: string;
};

type FatImportRow = {
  supplierId: number;
  supplierName: string;
  sourceDate: string;
  targetDate: string;
  fat_pct: string;
  include: boolean;
  hasCurrentFat: boolean;
};

type ConfirmState = {
  title: string;
  message: string;
  confirmLabel?: string;
  tone?: 'default' | 'danger';
  onConfirm: () => void;
} | null;

type FatImportConfig = {
  rows: FatImportRow[];
  sourceLabel: string;
  targetLabel: string;
  targetDate: string;
};

function hasMeaningfulEntry(entry: DailyEntry): boolean {
  return Number(entry.qty ?? 0) !== 0 || Number(entry.fat_pct ?? 0) !== 0;
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function toDate(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function defaultQualityDateForPeriod(year: number, month: number, period: Period): string {
  return toDate(year, month, period === 'SECOND_HALF' ? 16 : 1);
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
  const { setGuard, requestNavigation } = useNavigationGuard();
  const locale = localeForLanguage(language);
  const inputLocale = inputLocaleForLanguage(language);
  const router = useRouter();

  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [period, setPeriod] = useState<Period>(getDefaultPeriod(now.getDate()));
  const [cityFilter, setCityFilter] = useState('');
  const [selectedDay, setSelectedDay] = useState(now.getDate());
  const [changes, setChanges] = useState<Record<string, string>>({});
  const [actionError, setActionError] = useState('');
  const [actionInfo, setActionInfo] = useState('');
  const [confirmState, setConfirmState] = useState<ConfirmState>(null);
  const [hiddenSuppliersOpen, setHiddenSuppliersOpen] = useState(false);
  const [hiddenSupplierSearch, setHiddenSupplierSearch] = useState('');
  const [supplierActionTarget, setSupplierActionTarget] = useState<Supplier | null>(null);
  const [fatImportOpen, setFatImportOpen] = useState(false);
  const [fatImportOnlyMissing, setFatImportOnlyMissing] = useState(true);
  const [fatImportRows, setFatImportRows] = useState<FatImportRow[]>([]);

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

  const { data: allSuppliers = [], isLoading: suppliersLoading } = useQuery({
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

  const previousMonthDate = useMemo(() => new Date(year, month - 2, 1), [year, month]);
  const previousYear = previousMonthDate.getFullYear();
  const previousMonth = previousMonthDate.getMonth() + 1;
  const previousMonthLabel = previousMonthDate.toLocaleDateString(locale, { month: 'long', year: 'numeric' });
  const currentMonthLabel = new Date(year, month - 1, 1).toLocaleDateString(locale, { month: 'long', year: 'numeric' });

  const { data: previousMonthEntries = [], isLoading: previousMonthEntriesLoading } = useQuery({
    queryKey: ['entries', previousYear, previousMonth, 'fat-import'],
    queryFn: () => fetchEntries(previousYear, previousMonth),
    enabled: fatImportOpen && period !== 'SECOND_HALF',
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
      setFatImportOpen(false);
      setFatImportRows([]);
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

  const availableCities = useMemo(
    () => [...new Set(allSuppliers.map((supplier) => supplier.city).filter(Boolean))] as string[],
    [allSuppliers]
  );

  const visibleSuppliers = useMemo(() => {
    const supplierIdsWithEntries = new Set(entries.filter(hasMeaningfulEntry).map((item) => item.supplier_id));
    return allSuppliers.filter((supplier) => {
      if (cityFilter && supplier.city !== cityFilter) return false;
      return !supplier.hidden_in_daily_entry || supplierIdsWithEntries.has(supplier.id);
    });
  }, [allSuppliers, cityFilter, entries]);

  const hiddenSuppliers = useMemo(
    () =>
      allSuppliers.filter((supplier) => {
        if (!supplier.hidden_in_daily_entry) return false;
        if (cityFilter && supplier.city !== cityFilter) return false;
        return true;
      }),
    [allSuppliers, cityFilter]
  );

  const filteredHiddenSuppliers = useMemo(() => {
    const term = hiddenSupplierSearch.trim().toLocaleLowerCase();
    if (!term) return hiddenSuppliers;

    return hiddenSuppliers.filter((supplier) =>
      `${supplier.first_name} ${supplier.last_name} ${supplier.city ?? ''}`.toLocaleLowerCase().includes(term)
    );
  }, [hiddenSupplierSearch, hiddenSuppliers]);

  useEffect(() => {
    if (!visibleSuppliers.length) return;
    setCorrectionDraft((prev) => {
      const nextSupplierId = visibleSuppliers.some((supplier) => supplier.id === prev.supplierId)
        ? prev.supplierId
        : visibleSuppliers[0].id;
      const nextDay = dayNumbers.includes(prev.day) ? prev.day : dayNumbers[0];

      if (prev.supplierId === nextSupplierId && prev.day === nextDay) {
        return prev;
      }

      return {
        ...prev,
        supplierId: nextSupplierId,
        day: nextDay,
      };
    });
  }, [visibleSuppliers, dayNumbers]);

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

  const fatImportConfig = useMemo<FatImportConfig>(() => {
    const currentFatEntries = entries.filter((item) => item.fat_pct !== null && item.fat_pct !== undefined);
    let sourceEntries = previousMonthEntries.filter((item) => item.fat_pct !== null && item.fat_pct !== undefined);
    let currentPeriodFatSuppliers = new Set(currentFatEntries.map((item) => item.supplier_id));
    let sourceLabel = previousMonthLabel;
    let targetLabel = t('daily.periodFull');
    let targetDate = toDate(year, month, 1);

    if (period === 'FIRST_HALF') {
      currentPeriodFatSuppliers = new Set(
        currentFatEntries
          .filter((item) => Number(item.date.slice(8, 10)) <= 15)
          .map((item) => item.supplier_id)
      );
      targetLabel = t('daily.periodFirst');
      targetDate = toDate(year, month, 1);
    } else if (period === 'SECOND_HALF') {
      sourceEntries = currentFatEntries.filter((item) => Number(item.date.slice(8, 10)) <= 15);
      currentPeriodFatSuppliers = new Set(
        currentFatEntries
          .filter((item) => Number(item.date.slice(8, 10)) >= 16)
          .map((item) => item.supplier_id)
      );
      sourceLabel = `${t('daily.periodFirst')} ${currentMonthLabel}`;
      targetLabel = t('daily.periodSecond');
      targetDate = toDate(year, month, 16);
    }

    const latestSourceFatBySupplier = new Map<number, DailyEntry>();
    for (const item of sourceEntries) {
      const existing = latestSourceFatBySupplier.get(item.supplier_id);
      if (!existing || existing.date < item.date) {
        latestSourceFatBySupplier.set(item.supplier_id, item);
      }
    }

    const rows: FatImportRow[] = [];
    for (const supplier of visibleSuppliers) {
      const sourceEntry = latestSourceFatBySupplier.get(supplier.id);
      if (!sourceEntry) continue;

      rows.push({
        supplierId: supplier.id,
        supplierName: `${supplier.first_name} ${supplier.last_name}`,
        sourceDate: sourceEntry.date,
        targetDate,
        fat_pct: String(sourceEntry.fat_pct ?? ''),
        include: true,
        hasCurrentFat: currentPeriodFatSuppliers.has(supplier.id),
      });
    }

    return { rows, sourceLabel, targetLabel, targetDate };
  }, [currentMonthLabel, entries, month, period, previousMonthEntries, previousMonthLabel, t, visibleSuppliers, year]);

  const fatImportLoading = fatImportOpen && period !== 'SECOND_HALF' && previousMonthEntriesLoading;

  useEffect(() => {
    if (!fatImportOpen) return;
    setFatImportRows((prev) => {
      const next = fatImportConfig.rows.map((row) => ({
        ...row,
        include: fatImportOnlyMissing ? !row.hasCurrentFat : true,
      }));

      if (
        prev.length === next.length &&
        prev.every(
          (row, index) =>
            row.supplierId === next[index].supplierId &&
            row.supplierName === next[index].supplierName &&
            row.sourceDate === next[index].sourceDate &&
            row.targetDate === next[index].targetDate &&
            row.fat_pct === next[index].fat_pct &&
            row.include === next[index].include &&
            row.hasCurrentFat === next[index].hasCurrentFat
        )
      ) {
        return prev;
      }

      return next;
    });
  }, [fatImportConfig.rows, fatImportOnlyMissing, fatImportOpen]);

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

    for (const supplier of visibleSuppliers) {
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
  }, [visibleSuppliers, dayNumbers, getCellValue]);

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

  function discardSupplierChanges(supplierId: number) {
    setChanges((prev) => {
      const next = { ...prev };
      const prefix = `${supplierId}_`;

      for (const key of Object.keys(next)) {
        if (key.startsWith(prefix)) delete next[key];
      }

      return next;
    });
  }

  function meaningfulEntriesForSupplier(supplierId: number) {
    return entries.filter((entry) => entry.supplier_id === supplierId && hasMeaningfulEntry(entry));
  }

  const visibilityMutation = useMutation({
    mutationFn: async ({
      supplier,
      hidden,
      deleteEntryIds = [],
    }: {
      supplier: Supplier;
      hidden: boolean;
      deleteEntryIds?: number[];
    }) => {
      if (hidden && deleteEntryIds.length) {
        for (const entryId of deleteEntryIds) {
          const deleteResponse = await fetch(`/api/daily-entries/${entryId}`, { method: 'DELETE' });
          if (!deleteResponse.ok) {
            throw await responseError(deleteResponse, 'Failed to clear supplier entries before hiding');
          }
        }
      }

      const response = await fetch(`/api/suppliers/${supplier.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hidden_in_daily_entry: hidden }),
      });

      if (!response.ok) {
        throw await responseError(
          response,
          hidden ? 'Failed to hide supplier from daily entry' : 'Failed to restore supplier to daily entry'
        );
      }

      return response.json() as Promise<Supplier>;
    },
    onSuccess: async (_data, variables) => {
      setActionError('');
      if (variables.hidden) {
        discardSupplierChanges(variables.supplier.id);
        setActionInfo(t('daily.supplierHidden'));
      } else {
        setActionInfo(t('daily.supplierShown'));
      }
      await queryClient.invalidateQueries({ queryKey: ['suppliers'] });
    },
    onError: (error) => {
      setActionInfo('');
      setActionError(error instanceof Error ? error.message : t('daily.visibilityActionFailed'));
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
  const unsavedNavigationTitle = t('daily.unsavedNavigationTitle');
  const unsavedNavigationMessage = t('daily.unsavedNavigationMessage');
  const saveAndLeaveLabel = t('daily.saveAndLeave');
  const leaveWithoutSavingLabel = t('daily.leaveWithoutSaving');
  const stayLabel = t('common.stay');
  const hasUnsavedChanges = Object.keys(changes).length > 0 && !editingDisabled;
  const showSaveActions = hasUnsavedChanges || saveMutation.isPending;

  const saveAndContinue = useCallback(async () => {
    if (!hasUnsavedChanges) return true;

    try {
      await saveMutation.mutateAsync();
      return true;
    } catch {
      return false;
    }
  }, [hasUnsavedChanges, saveMutation.mutateAsync]);

  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => {
      if (!hasUnsavedChanges) return;
      event.preventDefault();
      event.returnValue = unsavedWarning;
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [hasUnsavedChanges, unsavedWarning]);

  useEffect(() => {
    if (!hasUnsavedChanges) {
      setGuard(null);
      return;
    }

    setGuard({
      enabled: true,
      title: unsavedNavigationTitle,
      message: unsavedNavigationMessage,
      saveLabel: saveAndLeaveLabel,
      leaveLabel: leaveWithoutSavingLabel,
      stayLabel,
      onSaveAndLeave: saveAndContinue,
    });

    return () => setGuard(null);
  }, [
    hasUnsavedChanges,
    leaveWithoutSavingLabel,
    saveAndContinue,
    saveAndLeaveLabel,
    setGuard,
    stayLabel,
    unsavedNavigationMessage,
    unsavedNavigationTitle,
  ]);

  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const mobileInputRefs = useRef<Record<number, HTMLInputElement | null>>({});

  function focusCell(row: number, col: number) {
    const ref = inputRefs.current[`${row}_${col}`];
    ref?.focus();
    ref?.select();
  }

  function onCellKeyDown(event: React.KeyboardEvent<HTMLInputElement>, row: number, col: number) {
    if (editingDisabled) return;

    const maxRow = visibleSuppliers.length - 1;
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

    const maxRow = visibleSuppliers.length - 1;

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

    setQualityRows(
      baseRows.length
        ? baseRows
        : [{ date: defaultQualityDateForPeriod(year, month, period), fat_pct: '3.8' }]
    );
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

  const fatImportMutation = useMutation({
    mutationFn: async () => {
      if (editingDisabled) throw new Error(t('daily.editBlocked'));

      const payload = fatImportRows
        .filter((row) => row.include)
        .map((row) => ({
          supplierId: row.supplierId,
          date: row.targetDate,
          fat_pct: Number(row.fat_pct),
        }))
        .filter((row) => Number.isFinite(row.fat_pct) && row.fat_pct >= 0 && row.fat_pct <= 20);

      if (!payload.length) throw new Error(t('daily.importFatNoSelection'));

      const response = await fetch('/api/daily-entries/bulk-upsert', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) throw await responseError(response, 'Failed to import fat units');
      return response.json();
    },
    onSuccess: async () => {
      setActionError('');
      setActionInfo(t('daily.importFatSuccess'));
      setFatImportOpen(false);
      setFatImportRows([]);
      setFatImportOnlyMissing(true);
      await queryClient.invalidateQueries({ queryKey: ['entries', year, month] });
      await queryClient.invalidateQueries({ queryKey: ['daily-lock', year, month] });
    },
    onError: (error) => {
      setActionInfo('');
      setActionError(error instanceof Error ? error.message : t('daily.visibilityActionFailed'));
    },
  });

  function exportXlsx() {
    const rows: (string | number)[][] = [];
    rows.push([t('daily.supplier'), ...dayNumbers.map((d) => String(d)), t('daily.total'), t('daily.avgMm')]);

    for (const supplier of visibleSuppliers) {
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
      setConfirmState({
        title: t('common.confirmAction'),
        message: t('daily.confirmLockUnsaved'),
        confirmLabel: t('daily.lockMonth'),
        onConfirm: () => {
          setConfirmState({
            title: t('common.confirmAction'),
            message: t('daily.confirmLock'),
            confirmLabel: t('daily.lockMonth'),
            onConfirm: () => {
              setConfirmState(null);
              lockMutation.mutate(true);
            },
          });
        },
      });
      return;
    }

    setConfirmState({
      title: t('common.confirmAction'),
      message: isLocked ? t('daily.confirmUnlock') : t('daily.confirmLock'),
      confirmLabel: isLocked ? t('daily.unlockMonth') : t('daily.lockMonth'),
      onConfirm: () => {
        setConfirmState(null);
        lockMutation.mutate(!isLocked);
      },
    });
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

          <label className="muted">{t('suppliers.city')}</label>
          <select className="input" value={cityFilter} onChange={(e) => setCityFilter(e.target.value)}>
            <option value="">{t('common.allCities')}</option>
            {availableCities.map((city) => (
              <option key={city} value={city}>
                {city}
              </option>
            ))}
          </select>

          <button className="btn" onClick={toggleMonthLock} disabled={lockLoading || lockMutation.isPending}>
            {lockMutation.isPending ? t('common.saving') : isLocked ? t('daily.unlockMonth') : t('daily.lockMonth')}
          </button>

          {hiddenSuppliers.length > 0 ? (
            <button
              className="btn"
              onClick={() => setHiddenSuppliersOpen(true)}
              disabled={visibilityMutation.isPending}
              title={t('daily.hiddenSuppliersHint')}
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                {t('daily.hiddenSuppliers')} ({hiddenSuppliers.length}) <UserPlus size={14} />
              </span>
            </button>
          ) : null}

          <button
            className="btn"
            onClick={() => {
              setFatImportOnlyMissing(true);
              setFatImportOpen(true);
            }}
            disabled={editingDisabled || fatImportMutation.isPending}
            title={`${t('daily.importFatTooltip')} ${fatImportConfig.sourceLabel}. ${t('daily.importFatTargetPart')} ${fatImportConfig.targetLabel}.`}
          >
            {t('daily.importFatFromPrevious')}
          </button>

          {showSaveActions ? (
            <>
              <button className="btn" onClick={() => setChanges({})} disabled={editingDisabled || saveMutation.isPending}>
                {t('daily.discard')}
              </button>

              <button className="btn primary" onClick={() => saveMutation.mutate()} disabled={editingDisabled || saveMutation.isPending}>
                {saveMutation.isPending ? t('daily.saving') : t('daily.saveAll')}
              </button>
            </>
          ) : null}

          <button className="btn" onClick={exportXlsx} aria-label={t('common.exportXlsx')} title={t('common.exportXlsx')}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              {t('common.export')} <FileSpreadsheet size={14} />
            </span>
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
          ) : visibleSuppliers.length === 0 ? (
            <div style={{ padding: 12 }} className="muted">
              {t('daily.noSuppliers')}
            </div>
          ) : (
            <div>
              {visibleSuppliers.map((supplier, rowIndex) => {
                const cellKey = `${supplier.id}_${selectedDay}`;
                const hasFat = fatMap.has(cellKey);
                const value = changes[cellKey] ?? String(getCellValue(supplier.id, selectedDay));

                return (
                  <div key={supplier.id} className="daily-mobile-row">
                    <div>
                      <div className="daily-mobile-header">
                        <button
                          type="button"
                          className="daily-supplier-trigger"
                          onClick={() => setSupplierActionTarget(supplier)}
                        >
                          {supplier.first_name} {supplier.last_name}
                        </button>
                      </div>
                      <div className="daily-mobile-meta">
                        {t('daily.total')}: {Math.round(rowTotals[supplier.id] ?? 0)}
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
        <table className="data-table daily-entry-table">
          <thead>
            <tr>
              <th>{t('daily.supplier')}</th>
              {dayNumbers.map((day) => (
                <th key={day} className="daily-day-col">
                  {day}
                </th>
              ))}
              <th>{t('daily.total')}</th>
              <th>{t('daily.avgMm')}</th>
              <th className="daily-quality-col" title={t('daily.quality')}>
                <span className="daily-quality-icon" aria-hidden="true">
                  <Droplets size={14} />
                </span>
              </th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={dayNumbers.length + 4}>{t('common.loading')}</td>
              </tr>
            ) : visibleSuppliers.length === 0 ? (
              <tr>
                <td colSpan={dayNumbers.length + 4}>{t('daily.noSuppliers')}</td>
              </tr>
            ) : (
              visibleSuppliers.map((supplier, rowIndex) => (
                <tr key={supplier.id}>
                  <td>
                    <div className="daily-supplier-cell">
                      <button
                        type="button"
                        className="daily-supplier-trigger"
                        onClick={() => setSupplierActionTarget(supplier)}
                      >
                        {supplier.first_name} {supplier.last_name}
                      </button>
                    </div>
                  </td>
                  {dayNumbers.map((day, colIndex) => {
                    const cellKey = `${supplier.id}_${day}`;
                    const hasFat = fatMap.has(cellKey);
                    const value = changes[cellKey] ?? String(getCellValue(supplier.id, day));

                    return (
                      <td key={day} className="daily-day-cell" style={{ background: hasFat ? '#fffbeb' : 'white' }}>
                        <input
                          ref={(el) => {
                            inputRefs.current[`${rowIndex}_${colIndex}`] = el;
                          }}
                          className="input daily-entry-cell-input"
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
                  <td className="daily-total-col" style={{ fontWeight: 600 }}>
                    {Math.round(rowTotals[supplier.id] ?? 0)}
                  </td>
                  <td>{averageFatForSupplier(supplier.id)}</td>
                  <td className="daily-quality-col">
                    <button
                      className="btn icon-btn"
                      onClick={() => openQualityEditor(supplier)}
                      disabled={editingDisabled}
                      aria-label={t('daily.editMm')}
                      title={t('daily.editMm')}
                    >
                      <Droplets size={14} />
                    </button>
                  </td>
                </tr>
              ))
            )}
            {visibleSuppliers.length > 0 ? (
              <tr style={{ background: '#f8fafc' }}>
                <td style={{ fontWeight: 700 }}>{t('daily.totals')}</td>
                {dayNumbers.map((day) => (
                  <td key={day} style={{ fontWeight: 700, textAlign: 'center' }}>
                    {Math.round(colTotals[day] ?? 0)}
                  </td>
                ))}
                <td className="daily-total-col" style={{ fontWeight: 700 }}>
                  {Math.round(grandTotal)}
                </td>
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
                    lang={inputLocale}
                    value={row.date}
                    disabled={editingDisabled}
                    onChange={(e) => {
                      const next = [...qualityRows];
                      next[index] = { ...next[index], date: e.target.value };
                      setQualityRows(next);
                    }}
                  />
                  <span className="muted" style={{ minWidth: 120, fontSize: 12 }}>
                    {row.date ? formatIsoDateForLocale(row.date, locale) : ''}
                  </span>
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
                    { date: defaultQualityDateForPeriod(year, month, period), fat_pct: '3.8' },
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
                {visibleSuppliers.map((supplier) => (
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

      {showSaveActions ? (
        <div className="daily-mobile-actions">
          <button className="btn" onClick={() => setChanges({})} disabled={editingDisabled || saveMutation.isPending}>
            {t('daily.discard')}
          </button>
          <button className="btn primary" onClick={() => saveMutation.mutate()} disabled={editingDisabled || saveMutation.isPending}>
            {saveMutation.isPending ? t('daily.saving') : t('daily.saveAll')}
          </button>
        </div>
      ) : null}

      {fatImportOpen ? (
        <div
          className="modal-backdrop"
          onClick={() => {
            if (fatImportMutation.isPending) return;
            setFatImportOpen(false);
            setFatImportRows([]);
            setFatImportOnlyMissing(true);
          }}
        >
          <div className="modal-panel" style={{ width: 'min(860px, 100%)' }} onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <div style={{ display: 'grid', gap: 4 }}>
                <h3 style={{ margin: 0 }}>{t('daily.importFatTitle')}</h3>
                <div className="muted">{`${t('daily.importFatSubtitle')} ${fatImportConfig.sourceLabel}.`}</div>
              </div>
              <button
                className="btn"
                type="button"
                onClick={() => {
                  setFatImportOpen(false);
                  setFatImportRows([]);
                  setFatImportOnlyMissing(true);
                }}
                disabled={fatImportMutation.isPending}
              >
                {t('common.close')}
              </button>
            </div>

            {fatImportLoading ? (
              <div className="muted">{t('common.loading')}</div>
            ) : fatImportConfig.rows.length === 0 ? (
              <div className="muted">{t('daily.importFatNoSource')}</div>
            ) : (
              <div style={{ display: 'grid', gap: 12 }}>
                <div className="muted" style={{ fontSize: 12 }}>
                  {`${t('daily.importFatSubtitle')} ${fatImportConfig.sourceLabel}. ${t('daily.importFatTargetPart')} ${fatImportConfig.targetLabel}.`}
                </div>

                <label className="control-row" style={{ justifyContent: 'space-between' }}>
                  <span className="muted">{t('daily.importFatOnlyMissing')}</span>
                  <input
                    type="checkbox"
                    checked={fatImportOnlyMissing}
                    onChange={(event) => setFatImportOnlyMissing(event.target.checked)}
                  />
                </label>

                <div className="daily-hidden-list">
                  {fatImportRows.map((row, index) => (
                    <div key={row.supplierId} className="daily-hidden-row" style={{ alignItems: 'flex-start' }}>
                      <div style={{ minWidth: 0, flex: 1, display: 'grid', gap: 4 }}>
                        <div className="daily-supplier-name">{row.supplierName}</div>
                        <div className="muted" style={{ fontSize: 12 }}>
                          {`${t('daily.importFatSourceDate')}: ${new Date(`${row.sourceDate}T00:00:00`).toLocaleDateString(locale)}`}
                        </div>
                        {row.hasCurrentFat ? (
                          <div className="badge" style={{ width: 'fit-content' }}>
                            {t('daily.importFatAlreadyExists')}
                          </div>
                        ) : null}
                      </div>

                      <div style={{ display: 'grid', gap: 8, minWidth: 180 }}>
                        <input
                          className="input"
                          type="number"
                          step="0.1"
                          value={row.fat_pct}
                          onChange={(event) =>
                            setFatImportRows((prev) => {
                              const next = [...prev];
                              next[index] = { ...next[index], fat_pct: event.target.value };
                              return next;
                            })
                          }
                          disabled={fatImportMutation.isPending || (fatImportOnlyMissing && row.hasCurrentFat)}
                        />
                        <label className="control-row" style={{ gap: 8 }}>
                          <input
                            type="checkbox"
                            checked={row.include}
                            disabled={fatImportMutation.isPending || (fatImportOnlyMissing && row.hasCurrentFat)}
                            onChange={(event) =>
                              setFatImportRows((prev) => {
                                const next = [...prev];
                                next[index] = { ...next[index], include: event.target.checked };
                                return next;
                              })
                            }
                          />
                          <span className="muted">{t('daily.importFatInclude')}</span>
                        </label>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="control-row" style={{ justifyContent: 'flex-end' }}>
                  <button
                    className="btn"
                    type="button"
                    onClick={() => {
                      setFatImportOpen(false);
                      setFatImportRows([]);
                      setFatImportOnlyMissing(true);
                    }}
                    disabled={fatImportMutation.isPending}
                  >
                    {t('common.cancel')}
                  </button>
                  <button
                    className="btn primary"
                    type="button"
                    onClick={() => fatImportMutation.mutate()}
                    disabled={fatImportMutation.isPending}
                  >
                    {fatImportMutation.isPending ? t('common.saving') : t('daily.importFatApply')}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : null}

      {hiddenSuppliersOpen ? (
        <div
          className="modal-backdrop"
          onClick={() => {
            if (visibilityMutation.isPending) return;
            setHiddenSuppliersOpen(false);
            setHiddenSupplierSearch('');
          }}
        >
          <div className="modal-panel" style={{ width: 'min(720px, 100%)' }} onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <div style={{ display: 'grid', gap: 4 }}>
                <h3 style={{ margin: 0 }}>{t('daily.hiddenSuppliers')}</h3>
                <div className="muted">{t('daily.hiddenSuppliersHint')}</div>
              </div>
              <button
                className="btn"
                type="button"
                onClick={() => {
                  setHiddenSuppliersOpen(false);
                  setHiddenSupplierSearch('');
                }}
                disabled={visibilityMutation.isPending}
              >
                {t('common.close')}
              </button>
            </div>

            {hiddenSuppliers.length === 0 ? (
              <div className="muted">{t('daily.noHiddenSuppliers')}</div>
            ) : (
              <div style={{ display: 'grid', gap: 12 }}>
                <input
                  className="input"
                  value={hiddenSupplierSearch}
                  onChange={(event) => setHiddenSupplierSearch(event.target.value)}
                  placeholder={t('producerHistory.searchSupplier')}
                />

                <div className="daily-hidden-list">
                  {filteredHiddenSuppliers.length === 0 ? (
                    <div className="muted">{t('common.noData')}</div>
                  ) : null}
                  {filteredHiddenSuppliers.map((supplier) => (
                  <div key={supplier.id} className="daily-hidden-row">
                    <div style={{ minWidth: 0 }}>
                      <div className="daily-supplier-name">
                        {supplier.first_name} {supplier.last_name}
                      </div>
                      <div className="muted" style={{ fontSize: 12 }}>
                        {supplier.city ?? t('common.noData')}
                      </div>
                    </div>

                    <button
                      className="btn primary"
                      onClick={() => visibilityMutation.mutate({ supplier, hidden: false })}
                      disabled={visibilityMutation.isPending}
                    >
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        {t('daily.showSupplier')} <UserPlus size={14} />
                      </span>
                    </button>
                  </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      ) : null}

      {supplierActionTarget ? (
        <div className="modal-backdrop" onClick={() => !visibilityMutation.isPending && setSupplierActionTarget(null)}>
          <div className="modal-panel" style={{ width: 'min(520px, 100%)' }} onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <div style={{ display: 'grid', gap: 4 }}>
                <h3 style={{ margin: 0 }}>
                  {supplierActionTarget.first_name} {supplierActionTarget.last_name}
                </h3>
                <div className="muted">
                  {supplierActionTarget.city ?? t('common.noData')}
                </div>
              </div>
              <button className="btn" type="button" onClick={() => setSupplierActionTarget(null)} disabled={visibilityMutation.isPending}>
                {t('common.close')}
              </button>
            </div>

            <div style={{ display: 'grid', gap: 10 }}>
              <button
                className="btn"
                type="button"
                onClick={() => {
                  setSupplierActionTarget(null);
                  requestNavigation(() => {
                    router.push(`/supplier-history?supplierId=${supplierActionTarget.id}`);
                  });
                }}
              >
                {t('daily.supplierDetails')}
              </button>

              <button
                className={`btn${supplierActionTarget.hidden_in_daily_entry ? ' primary' : ''}`}
                type="button"
                onClick={() => {
                  const target = supplierActionTarget;
                  setSupplierActionTarget(null);
                  if (target.hidden_in_daily_entry) {
                    visibilityMutation.mutate({ supplier: target, hidden: false });
                    return;
                  }

                  const supplierEntries = meaningfulEntriesForSupplier(target.id);
                  if (supplierEntries.length) {
                    setConfirmState({
                      title: t('daily.hideSupplierDeleteTitle'),
                      message: `${target.first_name} ${target.last_name}. ${t('daily.hideSupplierDeleteMessage')}`,
                      confirmLabel: t('daily.hideSupplierDeleteConfirm'),
                      tone: 'danger',
                      onConfirm: () => {
                        setConfirmState(null);
                        visibilityMutation.mutate({
                          supplier: target,
                          hidden: true,
                          deleteEntryIds: supplierEntries.map((entry) => entry.id),
                        });
                      },
                    });
                    return;
                  }

                  setConfirmState({
                    title: t('daily.hideSupplierTitle'),
                    message: `${target.first_name} ${target.last_name}. ${t('daily.hideSupplierMessage')}`,
                    confirmLabel: t('daily.hideSupplier'),
                    onConfirm: () => {
                      setConfirmState(null);
                      visibilityMutation.mutate({ supplier: target, hidden: true });
                    },
                  });
                }}
                disabled={visibilityMutation.isPending}
                title={supplierActionTarget.hidden_in_daily_entry ? t('daily.hiddenSuppliersHint') : undefined}
              >
                {supplierActionTarget.hidden_in_daily_entry ? t('daily.showSupplier') : t('daily.hideSupplier')}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <ConfirmDialog
        open={Boolean(confirmState)}
        title={confirmState?.title ?? ''}
        message={confirmState?.message ?? ''}
        confirmLabel={confirmState?.confirmLabel}
        tone={confirmState?.tone}
        busy={lockMutation.isPending || visibilityMutation.isPending}
        onCancel={() => setConfirmState(null)}
        onConfirm={() => confirmState?.onConfirm()}
      />
    </div>
  );
}
