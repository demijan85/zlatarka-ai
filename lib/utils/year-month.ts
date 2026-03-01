export function normalizeYearMonth(value: string): string {
  if (!/^\d{4}-\d{2}$/.test(value)) {
    throw new Error('Invalid year-month format. Expected YYYY-MM');
  }
  const month = Number(value.slice(5, 7));
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw new Error('Invalid year-month value. Month must be 01-12');
  }
  return value;
}

export function compareYearMonth(a: string, b: string): number {
  const [aYear, aMonth] = a.split('-').map(Number);
  const [bYear, bMonth] = b.split('-').map(Number);

  if (aYear !== bYear) return aYear - bYear;
  return aMonth - bMonth;
}

export function yearMonthFrom(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`;
}
