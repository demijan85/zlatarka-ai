export function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

export function toDateString(year: number, month: number, day: number): string {
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

export function formatIsoDateForLocale(value: string, locale: string): string {
  return new Date(`${value}T00:00:00`).toLocaleDateString(locale);
}

export function formatIsoDateLabelForLocale(value: string, locale: string): string {
  return value
    .split(' / ')
    .map((part) => formatIsoDateForLocale(part, locale))
    .join(' / ');
}

export function formatIsoDateForSerbianInput(value: string): string {
  const [year, month, day] = value.split('-');
  if (!year || !month || !day) return value;
  return `${Number(day)}.${Number(month)}.${year}.`;
}

export function parseSerbianDateInput(value: string): string | null {
  const normalized = value.trim();
  if (!normalized) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    const [year, month, day] = normalized.split('-').map(Number);
    const candidate = new Date(Date.UTC(year, month - 1, day));
    if (
      candidate.getUTCFullYear() === year &&
      candidate.getUTCMonth() === month - 1 &&
      candidate.getUTCDate() === day
    ) {
      return normalized;
    }
    return null;
  }

  const match = normalized.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})\.?$/);
  if (!match) return null;

  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const candidate = new Date(Date.UTC(year, month - 1, day));

  if (
    candidate.getUTCFullYear() !== year ||
    candidate.getUTCMonth() !== month - 1 ||
    candidate.getUTCDate() !== day
  ) {
    return null;
  }

  return `${year}-${pad2(month)}-${pad2(day)}`;
}

export function getMonthBounds(year: number, month: number): { startDate: string; endDate: string } {
  if (!Number.isInteger(year)) throw new Error('Invalid year');
  if (!Number.isInteger(month) || month < 1 || month > 12) throw new Error('Invalid month');

  const lastDay = new Date(year, month, 0).getDate();
  return {
    startDate: toDateString(year, month, 1),
    endDate: toDateString(year, month, lastDay),
  };
}

export function getQuarterBounds(year: number, quarter: number): { startDate: string; endDate: string } {
  if (!Number.isInteger(quarter) || quarter < 1 || quarter > 4) throw new Error('Invalid quarter');
  const startMonth = (quarter - 1) * 3 + 1;
  const endMonth = startMonth + 2;
  const { startDate } = getMonthBounds(year, startMonth);
  const { endDate } = getMonthBounds(year, endMonth);
  return { startDate, endDate };
}

export function parseYear(value: string | null, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : fallback;
}

export function parseMonth(value: string | null, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : fallback;
}

export function parseQuarter(value: string | null, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : fallback;
}
