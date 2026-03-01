import { createServerSupabaseClient } from '@/lib/supabase/server';
import { normalizeYearMonth } from '@/lib/utils/year-month';
import type { DailyIntakeLock } from '@/types/domain';

export class IntakeMonthLockedError extends Error {
  yearMonth: string;

  constructor(yearMonth: string) {
    super(`Daily intake for ${yearMonth} is locked`);
    this.name = 'IntakeMonthLockedError';
    this.yearMonth = yearMonth;
  }
}

function extractYearMonth(date: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error('Invalid date format. Expected YYYY-MM-DD');
  }
  return normalizeYearMonth(date.slice(0, 7));
}

function formatSupabaseError(error: unknown): string {
  if (!error) return 'Unknown Supabase error';

  if (error instanceof Error) {
    return error.message || 'Unknown Supabase error';
  }

  const payload = error as Record<string, unknown>;
  const code = typeof payload.code === 'string' ? payload.code : '';
  const message = typeof payload.message === 'string' ? payload.message : '';
  const details = typeof payload.details === 'string' ? payload.details : '';
  const hint = typeof payload.hint === 'string' ? payload.hint : '';

  const parts = [message || 'Unknown Supabase error'];
  if (code) parts.push(`code=${code}`);
  if (details) parts.push(`details=${details}`);
  if (hint) parts.push(`hint=${hint}`);

  if (code === '42P01' || code === 'PGRST205') {
    parts.push('daily_intake_locks table is missing; run v2/db/001_daily_intake_locks.sql in Supabase SQL editor');
  }

  if (code === '42501') {
    parts.push('permission denied; check RLS policies for daily_intake_locks');
  }

  return parts.join(' | ');
}

function mapRowToLock(row: { year_month: string; is_locked: boolean } | null): DailyIntakeLock {
  if (!row) {
    return { yearMonth: '', isLocked: false };
  }

  return {
    yearMonth: row.year_month,
    isLocked: row.is_locked,
  };
}

export async function getDailyIntakeLock(yearMonth: string): Promise<DailyIntakeLock> {
  const normalized = normalizeYearMonth(yearMonth);
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from('daily_intake_locks')
    .select('year_month, is_locked')
    .eq('year_month', normalized)
    .maybeSingle();

  if (error) throw new Error(`Failed to fetch intake lock: ${formatSupabaseError(error)}`);

  const lock = mapRowToLock((data as { year_month: string; is_locked: boolean } | null) ?? null);
  if (!lock.yearMonth) {
    return {
      yearMonth: normalized,
      isLocked: false,
    };
  }

  return lock;
}

export async function setDailyIntakeLock(yearMonth: string, isLocked: boolean): Promise<DailyIntakeLock> {
  const normalized = normalizeYearMonth(yearMonth);
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase
    .from('daily_intake_locks')
    .upsert(
      {
        year_month: normalized,
        is_locked: isLocked,
      },
      { onConflict: 'year_month' }
    )
    .select('year_month, is_locked')
    .single();

  if (error) throw new Error(`Failed to update intake lock: ${formatSupabaseError(error)}`);
  if (!data) {
    throw new Error(
      'Failed to update intake lock: empty Supabase response; check table permissions (RLS) for daily_intake_locks'
    );
  }

  return {
    yearMonth: data.year_month,
    isLocked: data.is_locked,
  };
}

export async function assertDailyIntakeUnlockedForDate(date: string): Promise<void> {
  const yearMonth = extractYearMonth(date);
  const lock = await getDailyIntakeLock(yearMonth);
  if (lock.isLocked) {
    throw new IntakeMonthLockedError(lock.yearMonth);
  }
}

export async function assertDailyIntakeUnlockedForDates(dates: string[]): Promise<void> {
  const uniqueMonths = [...new Set(dates.map((date) => extractYearMonth(date)))];

  for (const yearMonth of uniqueMonths) {
    const lock = await getDailyIntakeLock(yearMonth);
    if (lock.isLocked) {
      throw new IntakeMonthLockedError(lock.yearMonth);
    }
  }
}

export async function assertDailyIntakeUnlockedByEntryId(id: number): Promise<void> {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase.from('daily_entries').select('date').eq('id', id).maybeSingle();

  if (error) throw new Error(`Failed to check entry lock: ${formatSupabaseError(error)}`);
  if (!data) throw new Error(`Daily entry ${id} not found`);

  await assertDailyIntakeUnlockedForDate(data.date as string);
}
