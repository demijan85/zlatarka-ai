import {
  defaultCalculationConstants,
  defaultVersionedConstants,
  getEffectiveConstantsForPeriod,
  normalizeVersionedConstants,
  sortVersions,
  toCalculationConstants,
  type CalculationConstants,
  type VersionedCalculationConstants,
} from '@/lib/constants/calculation';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { normalizeYearMonth } from '@/lib/utils/year-month';

type ConstantVersionRow = {
  valid_from: string;
  price_per_fat_pct: number | string;
  tax_percentage: number | string;
  stimulation_low_threshold: number | string;
  stimulation_high_threshold: number | string;
  stimulation_low_amount: number | string;
  stimulation_high_amount: number | string;
  premium_per_liter: number | string;
};

function formatSupabaseError(error: unknown): string {
  if (!error) return 'Unknown Supabase error';
  if (error instanceof Error) return error.message || 'Unknown Supabase error';

  const payload = error as Record<string, unknown>;
  const code = typeof payload.code === 'string' ? payload.code : '';
  const message = typeof payload.message === 'string' ? payload.message : 'Unknown Supabase error';
  const details = typeof payload.details === 'string' ? payload.details : '';
  const hint = typeof payload.hint === 'string' ? payload.hint : '';

  const parts = [message];
  if (code) parts.push(`code=${code}`);
  if (details) parts.push(`details=${details}`);
  if (hint) parts.push(`hint=${hint}`);

  if (code === '42P01' || code === 'PGRST205') {
    parts.push('calculation_constants_versions table is missing; run v2/db/003_calculation_constants_versions.sql');
  }

  return parts.join(' | ');
}

function rowToVersion(row: ConstantVersionRow): VersionedCalculationConstants {
  return normalizeVersionedConstants({
    validFrom: row.valid_from,
    pricePerFatPct: Number(row.price_per_fat_pct),
    taxPercentage: Number(row.tax_percentage),
    stimulationLowThreshold: Number(row.stimulation_low_threshold),
    stimulationHighThreshold: Number(row.stimulation_high_threshold),
    stimulationLowAmount: Number(row.stimulation_low_amount),
    stimulationHighAmount: Number(row.stimulation_high_amount),
    premiumPerLiter: Number(row.premium_per_liter),
  });
}

function versionToRow(version: VersionedCalculationConstants): ConstantVersionRow {
  return {
    valid_from: version.validFrom,
    price_per_fat_pct: version.pricePerFatPct,
    tax_percentage: version.taxPercentage,
    stimulation_low_threshold: version.stimulationLowThreshold,
    stimulation_high_threshold: version.stimulationHighThreshold,
    stimulation_low_amount: version.stimulationLowAmount,
    stimulation_high_amount: version.stimulationHighAmount,
    premium_per_liter: version.premiumPerLiter,
  };
}

export async function listCalculationConstantVersions(): Promise<VersionedCalculationConstants[]> {
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase
    .from('calculation_constants_versions')
    .select(
      'valid_from, price_per_fat_pct, tax_percentage, stimulation_low_threshold, stimulation_high_threshold, stimulation_low_amount, stimulation_high_amount, premium_per_liter'
    )
    .order('valid_from', { ascending: true });

  if (error) throw new Error(`Failed to fetch constant versions: ${formatSupabaseError(error)}`);

  const mapped = ((data ?? []) as ConstantVersionRow[]).map(rowToVersion);
  return mapped.length ? sortVersions(mapped) : [defaultVersionedConstants];
}

export async function upsertCalculationConstantVersion(
  input: VersionedCalculationConstants
): Promise<VersionedCalculationConstants> {
  const version = normalizeVersionedConstants(input);
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase
    .from('calculation_constants_versions')
    .upsert(versionToRow(version), { onConflict: 'valid_from' })
    .select(
      'valid_from, price_per_fat_pct, tax_percentage, stimulation_low_threshold, stimulation_high_threshold, stimulation_low_amount, stimulation_high_amount, premium_per_liter'
    )
    .single();

  if (error) throw new Error(`Failed to save constant version: ${formatSupabaseError(error)}`);
  if (!data) throw new Error('Failed to save constant version: empty Supabase response');

  return rowToVersion(data as ConstantVersionRow);
}

export async function deleteCalculationConstantVersion(validFrom: string): Promise<void> {
  const normalized = normalizeYearMonth(validFrom);
  const supabase = createServerSupabaseClient();

  const { count, error: countError } = await supabase
    .from('calculation_constants_versions')
    .select('*', { count: 'exact', head: true });

  if (countError) throw new Error(`Failed to check version count: ${formatSupabaseError(countError)}`);
  if ((count ?? 0) <= 1) {
    throw new Error('At least one constants version must remain');
  }

  const { error } = await supabase.from('calculation_constants_versions').delete().eq('valid_from', normalized);
  if (error) throw new Error(`Failed to delete constants version: ${formatSupabaseError(error)}`);
}

export async function getEffectiveCalculationVersionForYearMonth(
  yearMonth: string
): Promise<VersionedCalculationConstants> {
  const normalized = normalizeYearMonth(yearMonth);
  const versions = await listCalculationConstantVersions();

  if (!versions.length) return defaultVersionedConstants;
  return getEffectiveConstantsForPeriod(versions, normalized);
}

export async function getEffectiveCalculationConstantsForYearMonth(
  yearMonth: string
): Promise<CalculationConstants> {
  const effective = await getEffectiveCalculationVersionForYearMonth(yearMonth);
  return toCalculationConstants(effective) ?? defaultCalculationConstants;
}
