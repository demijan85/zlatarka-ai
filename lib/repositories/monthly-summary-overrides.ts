import { createServerSupabaseClient } from '@/lib/supabase/server';
import type { MonthlySummaryOverride } from '@/types/domain';
import type { Period } from '@/lib/utils/period';

type OverrideRow = {
  supplier_id: number;
  year_month: string;
  period: Period;
  price_with_tax_override: number | null;
  stimulation_override: number | null;
};

function rowToOverride(row: OverrideRow): MonthlySummaryOverride {
  return {
    supplierId: row.supplier_id,
    yearMonth: row.year_month,
    period: row.period,
    priceWithTaxOverride: row.price_with_tax_override,
    stimulationOverride: row.stimulation_override,
  };
}

export async function listMonthlySummaryOverrides(yearMonth: string, period: Period): Promise<MonthlySummaryOverride[]> {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from('monthly_summary_overrides')
    .select('supplier_id, year_month, period, price_with_tax_override, stimulation_override')
    .eq('year_month', yearMonth)
    .eq('period', period);

  if (error) throw new Error(`Failed to fetch monthly summary overrides: ${error.message}`);
  return ((data ?? []) as OverrideRow[]).map(rowToOverride);
}

export async function upsertMonthlySummaryOverride(input: MonthlySummaryOverride): Promise<MonthlySummaryOverride | null> {
  const supabase = createServerSupabaseClient();
  const normalizedPriceOverride = input.priceWithTaxOverride ?? null;
  const normalizedStimulationOverride = input.stimulationOverride ?? null;

  if (normalizedPriceOverride === null && normalizedStimulationOverride === null) {
    const { error } = await supabase
      .from('monthly_summary_overrides')
      .delete()
      .eq('year_month', input.yearMonth)
      .eq('period', input.period)
      .eq('supplier_id', input.supplierId);

    if (error) throw new Error(`Failed to clear monthly summary override: ${error.message}`);
    return null;
  }

  const { data, error } = await supabase
    .from('monthly_summary_overrides')
    .upsert(
      {
        supplier_id: input.supplierId,
        year_month: input.yearMonth,
        period: input.period,
        price_with_tax_override: normalizedPriceOverride,
        stimulation_override: normalizedStimulationOverride,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'year_month,period,supplier_id' }
    )
    .select('supplier_id, year_month, period, price_with_tax_override, stimulation_override')
    .single();

  if (error) throw new Error(`Failed to save monthly summary override: ${error.message}`);
  return rowToOverride(data as OverrideRow);
}
