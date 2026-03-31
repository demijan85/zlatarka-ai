export type Period = 'first' | 'second' | 'all';

export function normalizePeriod(value: string | null | undefined): Period {
  if (value === 'first' || value === 'second' || value === 'all') return value;
  return 'all';
}

export function filterDatesByPeriod(dateStr: string, period: Period): boolean {
  if (period === 'all') return true;
  const day = Number(dateStr.slice(8, 10));
  if (period === 'first') return day <= 15;
  return day >= 16;
}

export function periodStartDate(year: number, month: number, period: Exclude<Period, 'all'> | 'all' = 'all'): string {
  const day = period === 'second' ? 16 : 1;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}
