import { average, monthlyTotalAmount } from '@/lib/calculations/formulas';
import { getEffectiveConstantsForPeriod, toCalculationConstants } from '@/lib/constants/calculation';
import { listCalculationConstantVersions } from '@/lib/repositories/calculation-constants';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getMonthBounds } from '@/lib/utils/date';
import { yearMonthFrom } from '@/lib/utils/year-month';
import type { DailyEntry, Supplier, SupplierHistory, SupplierHistoryDay, SupplierHistoryMonth } from '@/types/domain';

async function fetchSupplierById(supplierId: number): Promise<Supplier | null> {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase.from('suppliers').select('*').eq('id', supplierId).maybeSingle();

  if (error) throw new Error(`Failed to fetch supplier ${supplierId}: ${error.message}`);
  return (data as Supplier | null) ?? null;
}

async function fetchSupplierEntriesForYear(supplierId: number, year: number): Promise<DailyEntry[]> {
  const supabase = createServerSupabaseClient();
  const { endDate } = getMonthBounds(year, 12);
  const yearStart = `${year}-01-01`;

  const { data, error } = await supabase
    .from('daily_entries')
    .select('*')
    .eq('supplier_id', supplierId)
    .gte('date', yearStart)
    .lte('date', endDate)
    .order('date', { ascending: true });

  if (error) throw new Error(`Failed to fetch supplier history: ${error.message}`);
  return (data ?? []) as DailyEntry[];
}

export async function getSupplierHistory(supplierId: number, year: number): Promise<SupplierHistory> {
  const supplier = await fetchSupplierById(supplierId);
  if (!supplier) throw new Error(`Supplier ${supplierId} not found`);

  const [entries, versions] = await Promise.all([
    fetchSupplierEntriesForYear(supplierId, year),
    listCalculationConstantVersions(),
  ]);

  const entriesByMonth = new Map<number, DailyEntry[]>();
  for (const entry of entries) {
    const month = Number(entry.date.slice(5, 7));
    const monthEntries = entriesByMonth.get(month) ?? [];
    monthEntries.push(entry);
    entriesByMonth.set(month, monthEntries);
  }

  const months: SupplierHistoryMonth[] = Array.from({ length: 12 }, (_, index) => {
    const month = index + 1;
    const monthEntries = entriesByMonth.get(month) ?? [];
    const fatValues = monthEntries.map((item) => item.fat_pct).filter((value): value is number => value !== null && value !== undefined);
    const qty = monthEntries.reduce((sum, item) => sum + Number(item.qty || 0), 0);
    const fatPct = average(fatValues);
    const effectiveVersion = getEffectiveConstantsForPeriod(versions, yearMonthFrom(year, month));
    const constants = toCalculationConstants(effectiveVersion);
    const totals = monthlyTotalAmount(qty, fatPct, constants);

    return {
      month,
      qty,
      fatPct,
      pricePerQty: totals.pricePerQty,
      priceWithTax: totals.priceWithTax,
      stimulation: totals.stimulation,
      totalAmount: totals.totalAmount,
      activeDays: monthEntries.filter((item) => Number(item.qty || 0) > 0 || item.fat_pct !== null).length,
      measurementCount: fatValues.length,
      constantsValidFrom: effectiveVersion.validFrom,
    };
  });

  const totalQty = months.reduce((sum, item) => sum + item.qty, 0);
  const totalAmount = months.reduce((sum, item) => sum + item.totalAmount, 0);
  const totalStimulationAmount = months.reduce((sum, item) => sum + item.qty * item.stimulation, 0);
  const weightedFat = months.reduce((sum, item) => sum + item.qty * item.fatPct, 0);
  const activeDays = months.reduce((sum, item) => sum + item.activeDays, 0);
  const measurementCount = months.reduce((sum, item) => sum + item.measurementCount, 0);
  const lastDeliveryDate =
    [...entries].reverse().find((item) => Number(item.qty || 0) > 0 || item.fat_pct !== null)?.date ?? null;

  const dailyEntries: SupplierHistoryDay[] = entries.map((entry) => ({
    date: entry.date,
    month: Number(entry.date.slice(5, 7)),
    day: Number(entry.date.slice(8, 10)),
    qty: Number(entry.qty || 0),
    fatPct: entry.fat_pct,
  }));

  return {
    supplier,
    year,
    summary: {
      totalQty,
      totalAmount,
      avgFatPct: totalQty > 0 ? weightedFat / totalQty : 0,
      totalStimulationAmount,
      activeMonths: months.filter((item) => item.qty > 0 || item.measurementCount > 0).length,
      activeDays,
      measurementCount,
      lastDeliveryDate,
    },
    months,
    dailyEntries,
  };
}
