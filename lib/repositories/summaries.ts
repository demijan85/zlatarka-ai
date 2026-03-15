import { defaultCalculationConstants, type CalculationConstants } from '@/lib/constants/calculation';
import { applyMonthlySummaryOverrides, average, monthlyTotalAmount, quarterlyTotalPremium } from '@/lib/calculations/formulas';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { listMonthlySummaryOverrides } from '@/lib/repositories/monthly-summary-overrides';
import { getMonthBounds, getQuarterBounds } from '@/lib/utils/date';
import { filterDatesByPeriod, type Period } from '@/lib/utils/period';
import { yearMonthFrom } from '@/lib/utils/year-month';
import type { DailyEntry, MonthlySummaryRow, QuarterlySummaryRow, Supplier } from '@/types/domain';

function calculateMonthlyRow(
  serialNum: number,
  supplier: Supplier,
  entries: DailyEntry[],
  constants: CalculationConstants,
  overrides?: {
    priceWithTaxOverride: number | null;
    stimulationOverride: number | null;
  }
): MonthlySummaryRow {
  const qty = entries.reduce((sum, item) => sum + Number(item.qty || 0), 0);
  const fatValues = entries.map((item) => item.fat_pct).filter((x): x is number => x !== null && x !== undefined);
  const fatPct = average(fatValues);
  const calculated = monthlyTotalAmount(qty, fatPct, constants);
  const { pricePerFatPct, pricePerQty, priceWithTax, stimulation, totalAmount } = applyMonthlySummaryOverrides(
    qty,
    fatPct,
    {
      pricePerFatPct: constants.pricePerFatPct,
      pricePerQty: calculated.pricePerQty,
      priceWithTax: calculated.priceWithTax,
      stimulation: calculated.stimulation,
    },
    constants.taxPercentage,
    {
      priceWithTaxOverride: overrides?.priceWithTaxOverride ?? null,
      stimulationOverride: overrides?.stimulationOverride ?? null,
    }
  );

  return {
    serialNum,
    supplierId: supplier.id,
    firstName: supplier.first_name,
    lastName: supplier.last_name,
    city: supplier.city,
    street: supplier.street,
    zipCode: supplier.zip_code,
    jmbg: supplier.jmbg,
    bankAccount: supplier.bank_account,
    qty,
    fatPct,
    calculatedPricePerFatPct: constants.pricePerFatPct,
    pricePerFatPct,
    calculatedPricePerQty: calculated.pricePerQty,
    pricePerQty,
    taxPercentage: constants.taxPercentage,
    calculatedPriceWithTax: calculated.priceWithTax,
    priceWithTax,
    calculatedStimulation: calculated.stimulation,
    stimulation,
    totalAmount,
    priceWithTaxOverride: overrides?.priceWithTaxOverride ?? null,
    stimulationOverride: overrides?.stimulationOverride ?? null,
  };
}

async function fetchSuppliers(city?: string): Promise<Supplier[]> {
  const supabase = createServerSupabaseClient();
  let query = supabase.from('suppliers').select('*').order('order_index', { ascending: true });
  if (city) query = query.eq('city', city);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as Supplier[];
}

async function fetchEntriesByRange(
  supplierIds: number[],
  startDate: string,
  endDate: string
): Promise<DailyEntry[]> {
  if (!supplierIds.length) return [];

  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from('daily_entries')
    .select('*')
    .in('supplier_id', supplierIds)
    .gte('date', startDate)
    .lte('date', endDate);

  if (error) throw new Error(error.message);
  return (data ?? []) as DailyEntry[];
}

export async function getMonthlySummaries(options: {
  year: number;
  month: number;
  city?: string;
  period?: Period;
  constants?: CalculationConstants;
}): Promise<MonthlySummaryRow[]> {
  const constants = options.constants ?? defaultCalculationConstants;
  const period = options.period ?? 'all';
  const suppliers = await fetchSuppliers(options.city);
  if (!suppliers.length) return [];
  const yearMonth = yearMonthFrom(options.year, options.month);
  const overrides = await listMonthlySummaryOverrides(yearMonth, period);
  const overrideMap = new Map(
    overrides.map((item) => [
      item.supplierId,
      {
        priceWithTaxOverride: item.priceWithTaxOverride,
        stimulationOverride: item.stimulationOverride,
      },
    ])
  );

  const { startDate, endDate } = getMonthBounds(options.year, options.month);
  const entries = await fetchEntriesByRange(
    suppliers.map((item) => item.id),
    startDate,
    endDate
  );

  const filtered = entries.filter((item) => filterDatesByPeriod(item.date, period));
  const bySupplier: Record<number, DailyEntry[]> = {};

  for (const entry of filtered) {
    if (!bySupplier[entry.supplier_id]) bySupplier[entry.supplier_id] = [];
    bySupplier[entry.supplier_id].push(entry);
  }

  let serial = 1;
  return suppliers
    .map((supplier) => {
      const supplierEntries = bySupplier[supplier.id] ?? [];
      if (!supplierEntries.length) return null;
      return calculateMonthlyRow(serial++, supplier, supplierEntries, constants, overrideMap.get(supplier.id));
    })
    .filter((item): item is MonthlySummaryRow => item !== null && Number.isFinite(item.qty) && item.qty > 0);
}

export async function getQuarterlySummaries(options: {
  year: number;
  quarter: number;
  constants?: CalculationConstants;
}): Promise<QuarterlySummaryRow[]> {
  const constants = options.constants ?? defaultCalculationConstants;
  const suppliers = await fetchSuppliers();
  if (!suppliers.length) return [];

  const { startDate, endDate } = getQuarterBounds(options.year, options.quarter);
  const entries = await fetchEntriesByRange(
    suppliers.map((item) => item.id),
    startDate,
    endDate
  );

  const bySupplier: Record<number, DailyEntry[]> = {};
  for (const entry of entries) {
    if (!bySupplier[entry.supplier_id]) bySupplier[entry.supplier_id] = [];
    bySupplier[entry.supplier_id].push(entry);
  }

  let serialNum = 1;
  return suppliers
    .map((supplier) => {
      const supplierEntries = bySupplier[supplier.id] ?? [];
      if (!supplierEntries.length) return null;

      const qty = supplierEntries.reduce((sum, item) => sum + Number(item.qty || 0), 0);
      if (qty <= 0) return null;

      return {
        serialNum: serialNum++,
        supplierId: supplier.id,
        firstName: supplier.first_name,
        lastName: supplier.last_name,
        qty,
        cows: supplier.number_of_cows ?? 0,
        premiumPerL: constants.premiumPerLiter,
        totalPremium: quarterlyTotalPremium(qty, constants.premiumPerLiter),
      };
    })
    .filter((item): item is QuarterlySummaryRow => item !== null);
}
