import type { DailyEntry } from '@/types/domain';
import type { IntakeSnapshot, ProductionPeriod } from '@/types/production';
import { pad2 } from '@/lib/utils/date';
import { getWeekRange } from '@/lib/production/utils';

async function fetchMonth(year: number, month: number): Promise<DailyEntry[]> {
  const response = await fetch(`/api/daily-entries?year=${year}&month=${month}`, { cache: 'no-store' });
  if (!response.ok) throw new Error('Failed to fetch intake data');
  return (await response.json()) as DailyEntry[];
}

export async function fetchIntakeSnapshotsForYear(year: number): Promise<IntakeSnapshot[]> {
  const months = await Promise.all(Array.from({ length: 12 }, (_, index) => fetchMonth(year, index + 1)));
  return aggregateSnapshots(months.flat());
}

export async function fetchIntakeSnapshotsForMonth(year: number, month: number): Promise<IntakeSnapshot[]> {
  return aggregateSnapshots(await fetchMonth(year, month));
}

export async function fetchIntakeSnapshots(period: ProductionPeriod, year: number, month: number, day: number): Promise<IntakeSnapshot[]> {
  if (period === 'year') return fetchIntakeSnapshotsForYear(year);
  if (period === 'week') {
    const { start, end } = getWeekRange(year, month, day);
    const monthKeys = new Set<string>();
    const cursor = new Date(start);

    while (cursor <= end) {
      monthKeys.add(`${cursor.getFullYear()}-${cursor.getMonth() + 1}`);
      cursor.setMonth(cursor.getMonth() + 1, 1);
    }

    const entries = await Promise.all(
      [...monthKeys].map((key) => {
        const [fetchYear, fetchMonthValue] = key.split('-').map(Number);
        return fetchMonth(fetchYear, fetchMonthValue);
      })
    );

    return aggregateSnapshots(entries.flat());
  }
  return fetchIntakeSnapshotsForMonth(year, month);
}

export function aggregateSnapshots(entries: DailyEntry[]): IntakeSnapshot[] {
  const map = new Map<string, { qty: number; fatSum: number; fatCount: number; suppliers: Set<number> }>();

  for (const entry of entries) {
    const current = map.get(entry.date) ?? { qty: 0, fatSum: 0, fatCount: 0, suppliers: new Set<number>() };
    current.qty += Number(entry.qty ?? 0);
    if (entry.fat_pct !== null && entry.fat_pct !== undefined) {
      current.fatSum += entry.fat_pct;
      current.fatCount += 1;
    }
    current.suppliers.add(entry.supplier_id);
    map.set(entry.date, current);
  }

  return [...map.entries()]
    .map(([date, item]) => ({
      date,
      milkReceivedLiters: item.qty,
      averageFatUnit: item.fatCount > 0 ? item.fatSum / item.fatCount : null,
      supplierCount: item.suppliers.size,
    }))
    .sort((left, right) => left.date.localeCompare(right.date));
}

export function findSnapshot(snapshots: IntakeSnapshot[], date: string): IntakeSnapshot {
  return (
    snapshots.find((item) => item.date === date) ?? {
      date,
      milkReceivedLiters: 0,
      averageFatUnit: null,
      supplierCount: 0,
    }
  );
}

export function buildPeriodLabel(period: ProductionPeriod, year: number, month: number, day: number) {
  if (period === 'year') return String(year);
  if (period === 'week') {
    const { startLabel, endLabel } = getWeekRange(year, month, day);
    return `${startLabel} - ${endLabel}`;
  }
  if (period === 'month') return `${year}-${pad2(month)}`;
  return `${year}-${pad2(month)}-${pad2(day)}`;
}
