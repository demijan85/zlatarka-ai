import { createServerSupabaseClient } from '@/lib/supabase/server';
import type { DailyEntry } from '@/types/domain';
import { getMonthBounds } from '@/lib/utils/date';
import {
  assertDailyIntakeUnlockedByEntryId,
  assertDailyIntakeUnlockedForDate,
  assertDailyIntakeUnlockedForDates,
} from './daily-intake-locks';

const PAGE_SIZE = 1000;

async function ensureSupplierExists(supplierId: number): Promise<void> {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase.from('suppliers').select('id').eq('id', supplierId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error(`Supplier ${supplierId} not found`);
}

export async function getDailyEntriesForMonth(year: number, month: number): Promise<DailyEntry[]> {
  const supabase = createServerSupabaseClient();
  const { startDate, endDate } = getMonthBounds(year, month);
  const allEntries: DailyEntry[] = [];

  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from('daily_entries')
      .select('*, supplier:suppliers!inner(*)')
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: true })
      .order('supplier_id', { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    if (error) throw new Error(`Failed to fetch daily entries: ${error.message}`);

    const page = (data ?? []) as DailyEntry[];
    allEntries.push(...page);
    if (page.length < PAGE_SIZE) break;
  }

  return allEntries.sort((a, b) => {
    const leftOrder = a.supplier?.order_index ?? Number.MAX_SAFE_INTEGER;
    const rightOrder = b.supplier?.order_index ?? Number.MAX_SAFE_INTEGER;
    if (leftOrder !== rightOrder) return leftOrder - rightOrder;
    return a.date.localeCompare(b.date);
  });
}

export async function upsertDailyEntry(payload: {
  date: string;
  supplierId: number;
  qty?: number;
  fat_pct?: number | null;
}): Promise<DailyEntry> {
  await assertDailyIntakeUnlockedForDate(payload.date);
  return upsertDailyEntryUnchecked(payload);
}

export async function upsertDailyEntryIgnoringLock(payload: {
  date: string;
  supplierId: number;
  qty?: number;
  fat_pct?: number | null;
}): Promise<DailyEntry> {
  return upsertDailyEntryUnchecked(payload);
}

async function upsertDailyEntryUnchecked(payload: {
  date: string;
  supplierId: number;
  qty?: number;
  fat_pct?: number | null;
}): Promise<DailyEntry> {
  await ensureSupplierExists(payload.supplierId);

  const supabase = createServerSupabaseClient();
  const { data: existing, error: existingError } = await supabase
    .from('daily_entries')
    .select('*')
    .eq('supplier_id', payload.supplierId)
    .eq('date', payload.date)
    .maybeSingle();

  if (existingError) throw new Error(existingError.message);

  if (existing) {
    const { data, error } = await supabase
      .from('daily_entries')
      .update({
        qty: payload.qty ?? existing.qty,
        fat_pct: payload.fat_pct ?? existing.fat_pct,
        supplier_id: payload.supplierId,
        date: payload.date,
      })
      .eq('id', existing.id)
      .select('*')
      .single();

    if (error) throw new Error(error.message);
    return data as DailyEntry;
  }

  const { data, error } = await supabase
    .from('daily_entries')
    .insert({
      date: payload.date,
      supplier_id: payload.supplierId,
      qty: payload.qty ?? 0,
      fat_pct: payload.fat_pct ?? null,
    })
    .select('*')
    .single();

  if (error) throw new Error(error.message);
  return data as DailyEntry;
}

export async function bulkUpsertDailyEntries(
  payload: Array<{ date: string; supplierId: number; qty?: number; fat_pct?: number | null }>
): Promise<DailyEntry[]> {
  await assertDailyIntakeUnlockedForDates(payload.map((item) => item.date));
  const result: DailyEntry[] = [];
  for (const entry of payload) {
    result.push(await upsertDailyEntry(entry));
  }
  return result;
}

export async function deleteDailyEntry(id: number): Promise<void> {
  await assertDailyIntakeUnlockedByEntryId(id);
  const supabase = createServerSupabaseClient();
  const { error } = await supabase.from('daily_entries').delete().eq('id', id);
  if (error) throw new Error(`Failed to delete daily entry ${id}: ${error.message}`);
}
