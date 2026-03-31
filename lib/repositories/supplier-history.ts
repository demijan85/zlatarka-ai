import { average, monthlyTotalAmount } from '@/lib/calculations/formulas';
import { getEffectiveConstantsForPeriod, toCalculationConstants, type VersionedCalculationConstants } from '@/lib/constants/calculation';
import { listCalculationConstantVersions } from '@/lib/repositories/calculation-constants';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getMonthBounds } from '@/lib/utils/date';
import type { DailyEntry, Supplier, SupplierHistory, SupplierHistoryDay, SupplierHistoryMonth } from '@/types/domain';

function summarizeMonthEntries(
  entries: DailyEntry[],
  versions: VersionedCalculationConstants[]
): SupplierHistoryMonth & { constantsValidFrom: string } {
  const fatValues = entries.map((item) => item.fat_pct).filter((value): value is number => value !== null && value !== undefined);
  const qty = entries.reduce((sum, item) => sum + Number(item.qty || 0), 0);
  const fatPct = average(fatValues);

  if (qty <= 0) {
    return {
      month: Number(entries[0]?.date.slice(5, 7) ?? 0),
      qty,
      fatPct,
      pricePerQty: 0,
      priceWithTax: 0,
      stimulation: 0,
      totalAmount: 0,
      activeDays: entries.filter((item) => Number(item.qty || 0) > 0 || item.fat_pct !== null).length,
      measurementCount: fatValues.length,
      constantsValidFrom: versions[0]?.validFrom ?? '',
    };
  }

  const grouped = new Map<string, { version: VersionedCalculationConstants; entries: DailyEntry[] }>();
  for (const entry of entries) {
    const version = getEffectiveConstantsForPeriod(versions, entry.date);
    const existing = grouped.get(version.validFrom);
    if (existing) {
      existing.entries.push(entry);
      continue;
    }
    grouped.set(version.validFrom, { version, entries: [entry] });
  }

  let milkNetAmount = 0;
  let milkGrossAmount = 0;
  let stimulationAmount = 0;
  let totalAmount = 0;

  for (const group of grouped.values()) {
    const groupQty = group.entries.reduce((sum, item) => sum + Number(item.qty || 0), 0);
    const groupFatValues = group.entries
      .map((item) => item.fat_pct)
      .filter((value): value is number => value !== null && value !== undefined);
    const groupFatPct = average(groupFatValues);
    const constants = toCalculationConstants(group.version);
    const totals = monthlyTotalAmount(groupQty, groupFatPct, constants);

    milkNetAmount += groupQty * totals.pricePerQty;
    milkGrossAmount += groupQty * totals.priceWithTax;
    stimulationAmount += groupQty * totals.stimulation;
    totalAmount += totals.totalAmount;
  }

  const versionLabels = [...grouped.keys()].sort();
  const constantsValidFrom =
    versionLabels.length <= 1 ? (versionLabels[0] ?? '') : `${versionLabels[0]} / ${versionLabels[versionLabels.length - 1]}`;

  return {
    month: Number(entries[0]?.date.slice(5, 7) ?? 0),
    qty,
    fatPct,
    pricePerQty: milkNetAmount / qty,
    priceWithTax: milkGrossAmount / qty,
    stimulation: stimulationAmount / qty,
    totalAmount,
    activeDays: entries.filter((item) => Number(item.qty || 0) > 0 || item.fat_pct !== null).length,
    measurementCount: fatValues.length,
    constantsValidFrom,
  };
}

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
    const summarized = summarizeMonthEntries(monthEntries, versions);

    return {
      month,
      qty: summarized.qty,
      fatPct: summarized.fatPct,
      pricePerQty: summarized.pricePerQty,
      priceWithTax: summarized.priceWithTax,
      stimulation: summarized.stimulation,
      totalAmount: summarized.totalAmount,
      activeDays: summarized.activeDays,
      measurementCount: summarized.measurementCount,
      constantsValidFrom: summarized.constantsValidFrom,
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
