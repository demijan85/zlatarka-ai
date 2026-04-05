import {
  getEffectiveConstantsForPeriod,
  toCalculationConstants,
  type VersionedCalculationConstants,
} from '@/lib/constants/calculation';
import { applyMonthlySummaryOverrides, average, monthlyTotalAmount, quarterlyTotalPremium } from '@/lib/calculations/formulas';
import { listCalculationConstantVersions } from '@/lib/repositories/calculation-constants';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { listMonthlySummaryOverrides } from '@/lib/repositories/monthly-summary-overrides';
import { getMonthBounds, getQuarterBounds } from '@/lib/utils/date';
import { filterDatesByPeriod, type Period } from '@/lib/utils/period';
import { yearMonthFrom } from '@/lib/utils/year-month';
import type { DailyEntry, MonthlySummaryRow, QuarterlySummaryRow, QuarterlySummarySnapshot, Supplier } from '@/types/domain';

function summarizeEntriesWithVersions(
  entries: DailyEntry[],
  versions: VersionedCalculationConstants[]
): {
  qty: number;
  fatPct: number;
  pricePerFatPct: number;
  pricePerQty: number;
  taxPercentage: number;
  priceWithTax: number;
  stimulation: number;
  totalAmount: number;
} {
  const qty = entries.reduce((sum, item) => sum + Number(item.qty || 0), 0);
  const fatValues = entries.map((item) => item.fat_pct).filter((x): x is number => x !== null && x !== undefined);
  const fatPct = average(fatValues);

  if (qty <= 0) {
    return {
      qty,
      fatPct,
      pricePerFatPct: 0,
      pricePerQty: 0,
      taxPercentage: 0,
      priceWithTax: 0,
      stimulation: 0,
      totalAmount: 0,
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

  const pricePerQty = milkNetAmount / qty;
  const priceWithTax = milkGrossAmount / qty;
  const stimulation = stimulationAmount / qty;
  const pricePerFatPct = fatPct > 0 ? pricePerQty / fatPct : 0;
  const taxPercentage = pricePerQty > 0 ? ((priceWithTax / pricePerQty) - 1) * 100 : 0;

  return {
    qty,
    fatPct,
    pricePerFatPct,
    pricePerQty,
    taxPercentage,
    priceWithTax,
    stimulation,
    totalAmount,
  };
}

function calculateMonthlyRow(
  serialNum: number,
  supplier: Supplier,
  entries: DailyEntry[],
  versions: VersionedCalculationConstants[],
  overrides?: {
    priceWithTaxOverride: number | null;
    stimulationOverride: number | null;
  }
): MonthlySummaryRow {
  const calculated = summarizeEntriesWithVersions(entries, versions);
  const { pricePerFatPct, pricePerQty, priceWithTax, stimulation, totalAmount } = applyMonthlySummaryOverrides(
    calculated.qty,
    calculated.fatPct,
    {
      pricePerFatPct: calculated.pricePerFatPct,
      pricePerQty: calculated.pricePerQty,
      priceWithTax: calculated.priceWithTax,
      stimulation: calculated.stimulation,
    },
    calculated.taxPercentage,
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
    qty: calculated.qty,
    fatPct: calculated.fatPct,
    calculatedPricePerFatPct: calculated.pricePerFatPct,
    pricePerFatPct,
    calculatedPricePerQty: calculated.pricePerQty,
    pricePerQty,
    taxPercentage: calculated.taxPercentage,
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
  const pageSize = 1000;
  const rows: DailyEntry[] = [];

  for (let from = 0; ; from += pageSize) {
    const to = from + pageSize - 1;
    const { data, error } = await supabase
      .from('daily_entries')
      .select('*')
      .in('supplier_id', supplierIds)
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: true })
      .order('id', { ascending: true })
      .range(from, to);

    if (error) throw new Error(error.message);

    const page = (data ?? []) as DailyEntry[];
    rows.push(...page);

    if (page.length < pageSize) break;
  }

  return rows;
}

export async function getMonthlySummaries(options: {
  year: number;
  month: number;
  city?: string;
  period?: Period;
  versions?: VersionedCalculationConstants[];
}): Promise<MonthlySummaryRow[]> {
  const period = options.period ?? 'all';
  const [suppliers, versions] = await Promise.all([
    fetchSuppliers(options.city),
    options.versions ? Promise.resolve(options.versions) : listCalculationConstantVersions(),
  ]);
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
      return calculateMonthlyRow(serial++, supplier, supplierEntries, versions, overrideMap.get(supplier.id));
    })
    .filter((item): item is MonthlySummaryRow => item !== null && Number.isFinite(item.qty) && item.qty > 0);
}

export async function getQuarterlySummaries(options: {
  year: number;
  quarter: number;
  versions?: VersionedCalculationConstants[];
}): Promise<QuarterlySummaryRow[]> {
  const snapshot = await getQuarterlySummarySnapshot(options);
  return snapshot.rows;
}

export async function getQuarterlySummarySnapshot(options: {
  year: number;
  quarter: number;
  versions?: VersionedCalculationConstants[];
}): Promise<QuarterlySummarySnapshot> {
  const [suppliers, versions] = await Promise.all([
    fetchSuppliers(),
    options.versions ? Promise.resolve(options.versions) : listCalculationConstantVersions(),
  ]);
  const { startDate, endDate } = getQuarterBounds(options.year, options.quarter);
  if (!suppliers.length) {
    return {
      rows: [],
      coveredThroughDate: null,
      expectedEndDate: endDate,
      isComplete: false,
    };
  }

  const entries = await fetchEntriesByRange(
    suppliers.map((item) => item.id),
    startDate,
    endDate
  );
  const coveredThroughDate = entries.reduce<string | null>(
    (latest, entry) => (latest === null || entry.date > latest ? entry.date : latest),
    null
  );

  const bySupplier: Record<number, DailyEntry[]> = {};
  for (const entry of entries) {
    if (!bySupplier[entry.supplier_id]) bySupplier[entry.supplier_id] = [];
    bySupplier[entry.supplier_id].push(entry);
  }

  let serialNum = 1;
  const rows = suppliers
    .map((supplier) => {
      const supplierEntries = bySupplier[supplier.id] ?? [];
      if (!supplierEntries.length) return null;

      const qty = supplierEntries.reduce((sum, item) => sum + Number(item.qty || 0), 0);
      if (qty <= 0) return null;

      let totalPremium = 0;
      for (const entry of supplierEntries) {
        const version = getEffectiveConstantsForPeriod(versions, entry.date);
        const constants = toCalculationConstants(version);
        totalPremium += quarterlyTotalPremium(Number(entry.qty || 0), constants.premiumPerLiter);
      }

      return {
        serialNum: serialNum++,
        supplierId: supplier.id,
        firstName: supplier.first_name,
        lastName: supplier.last_name,
        qty,
        cows: supplier.number_of_cows ?? 0,
        premiumPerL: totalPremium / qty,
        totalPremium,
      };
    })
    .filter((item): item is QuarterlySummaryRow => item !== null);

  return {
    rows,
    coveredThroughDate,
    expectedEndDate: endDate,
    isComplete: coveredThroughDate === endDate,
  };
}
