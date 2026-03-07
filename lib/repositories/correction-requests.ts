import type { CorrectionRequest, CorrectionRequestStatus } from '@/types/domain';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { upsertDailyEntryIgnoringLock } from './daily-entries';

type CorrectionRequestDbRow = {
  id: number;
  year_month: string;
  supplier_id: number;
  entry_date: string;
  field_name: 'qty' | 'fat_pct';
  current_value: number | null;
  requested_value: number;
  reason: string;
  status: CorrectionRequestStatus;
  requested_by: string;
  requested_at: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_note: string | null;
  applied_entry_id: number | null;
  supplier?: {
    first_name: string;
    last_name: string;
  } | null;
};

function mapCorrection(row: CorrectionRequestDbRow): CorrectionRequest {
  const supplierName = row.supplier ? `${row.supplier.first_name} ${row.supplier.last_name}` : `Supplier #${row.supplier_id}`;
  return {
    id: row.id,
    yearMonth: row.year_month,
    supplierId: row.supplier_id,
    supplierName,
    entryDate: row.entry_date,
    fieldName: row.field_name,
    currentValue: row.current_value === null ? null : Number(row.current_value),
    requestedValue: Number(row.requested_value),
    reason: row.reason,
    status: row.status,
    requestedBy: row.requested_by,
    requestedAt: row.requested_at,
    reviewedBy: row.reviewed_by,
    reviewedAt: row.reviewed_at,
    reviewNote: row.review_note,
    appliedEntryId: row.applied_entry_id,
  };
}

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
  return parts.join(' | ');
}

export async function listCorrectionRequests(options: {
  yearMonth?: string;
  status?: CorrectionRequestStatus;
  supplierId?: number;
  limit?: number;
}): Promise<CorrectionRequest[]> {
  const supabase = createServerSupabaseClient();
  const limit = options.limit ?? 200;

  let query = supabase
    .from('correction_requests')
    .select('*, supplier:suppliers(first_name,last_name)')
    .order('requested_at', { ascending: false })
    .limit(limit);

  if (options.yearMonth) query = query.eq('year_month', options.yearMonth);
  if (options.status) query = query.eq('status', options.status);
  if (options.supplierId) query = query.eq('supplier_id', options.supplierId);

  const { data, error } = await query;
  if (error) throw new Error(`Failed to list correction requests: ${formatSupabaseError(error)}`);
  return ((data ?? []) as CorrectionRequestDbRow[]).map(mapCorrection);
}

export async function createCorrectionRequest(payload: {
  yearMonth: string;
  supplierId: number;
  entryDate: string;
  fieldName: 'qty' | 'fat_pct';
  requestedValue: number;
  reason: string;
  requestedBy: string;
}): Promise<CorrectionRequest> {
  if (!payload.entryDate.startsWith(`${payload.yearMonth}-`)) {
    throw new Error('entryDate must belong to selected yearMonth');
  }

  const supabase = createServerSupabaseClient();
  const { data: existing, error: existingError } = await supabase
    .from('daily_entries')
    .select('qty, fat_pct')
    .eq('supplier_id', payload.supplierId)
    .eq('date', payload.entryDate)
    .maybeSingle();

  if (existingError) throw new Error(`Failed to resolve current value: ${formatSupabaseError(existingError)}`);
  const currentValue = payload.fieldName === 'qty' ? (existing?.qty ?? 0) : (existing?.fat_pct ?? null);

  const { data, error } = await supabase
    .from('correction_requests')
    .insert({
      year_month: payload.yearMonth,
      supplier_id: payload.supplierId,
      entry_date: payload.entryDate,
      field_name: payload.fieldName,
      current_value: currentValue,
      requested_value: payload.requestedValue,
      reason: payload.reason,
      requested_by: payload.requestedBy,
      metadata: {},
    })
    .select('*, supplier:suppliers(first_name,last_name)')
    .single();

  if (error) throw new Error(`Failed to create correction request: ${formatSupabaseError(error)}`);
  return mapCorrection(data as CorrectionRequestDbRow);
}

export async function reviewCorrectionRequest(payload: {
  id: number;
  status: 'approved' | 'rejected';
  reviewedBy: string;
  reviewNote?: string;
}): Promise<CorrectionRequest> {
  const supabase = createServerSupabaseClient();
  const { data: existing, error: existingError } = await supabase
    .from('correction_requests')
    .select('*, supplier:suppliers(first_name,last_name)')
    .eq('id', payload.id)
    .maybeSingle();

  if (existingError) throw new Error(`Failed to fetch correction request: ${formatSupabaseError(existingError)}`);
  if (!existing) throw new Error(`Correction request ${payload.id} not found`);

  const row = existing as CorrectionRequestDbRow;
  if (row.status !== 'pending') {
    throw new Error(`Correction request ${payload.id} is already ${row.status}`);
  }

  let appliedEntryId: number | null = null;
  if (payload.status === 'approved') {
    const applied = await upsertDailyEntryIgnoringLock({
      date: row.entry_date,
      supplierId: row.supplier_id,
      qty: row.field_name === 'qty' ? row.requested_value : undefined,
      fat_pct: row.field_name === 'fat_pct' ? row.requested_value : undefined,
    });
    appliedEntryId = applied.id;
  }

  const { data: updated, error: updateError } = await supabase
    .from('correction_requests')
    .update({
      status: payload.status,
      reviewed_by: payload.reviewedBy,
      reviewed_at: new Date().toISOString(),
      review_note: payload.reviewNote?.trim() || null,
      applied_entry_id: appliedEntryId,
    })
    .eq('id', payload.id)
    .select('*, supplier:suppliers(first_name,last_name)')
    .single();

  if (updateError) throw new Error(`Failed to update correction request: ${formatSupabaseError(updateError)}`);
  return mapCorrection(updated as CorrectionRequestDbRow);
}
