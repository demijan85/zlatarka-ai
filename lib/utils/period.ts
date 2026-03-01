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
