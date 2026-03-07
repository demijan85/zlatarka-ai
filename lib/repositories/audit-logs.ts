import { createServerSupabaseClient } from '@/lib/supabase/server';
import type { AuditLogRecord } from '@/types/domain';

type AuditLogPayload = {
  actionType: string;
  entityType: string;
  entityId?: string | null;
  actorIdentifier: string;
  actorIp?: string | null;
  actorUserAgent?: string | null;
  metadata?: Record<string, unknown> | null;
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

  return parts.join(' | ');
}

export async function writeAuditLog(payload: AuditLogPayload): Promise<void> {
  const supabase = createServerSupabaseClient();

  const { error } = await supabase.from('audit_logs').insert({
    action_type: payload.actionType,
    entity_type: payload.entityType,
    entity_id: payload.entityId ?? null,
    actor_identifier: payload.actorIdentifier,
    actor_ip: payload.actorIp ?? null,
    actor_user_agent: payload.actorUserAgent ?? null,
    metadata: payload.metadata ?? {},
  });

  if (error) throw new Error(`Failed to write audit log: ${formatSupabaseError(error)}`);
}

export async function tryWriteAuditLog(payload: AuditLogPayload): Promise<void> {
  try {
    await writeAuditLog(payload);
  } catch (error) {
    // Do not block core workflows if audit insert fails.
    console.error(error);
  }
}

type AuditLogDbRow = {
  id: number;
  action_type: string;
  entity_type: string;
  entity_id: string | null;
  actor_identifier: string;
  actor_ip: string | null;
  created_at: string;
  metadata: Record<string, unknown> | null;
};

function mapAuditLog(row: AuditLogDbRow): AuditLogRecord {
  return {
    id: row.id,
    actionType: row.action_type,
    entityType: row.entity_type,
    entityId: row.entity_id,
    actorIdentifier: row.actor_identifier,
    actorIp: row.actor_ip,
    createdAt: row.created_at,
    metadata: row.metadata ?? {},
  };
}

export async function listAuditLogs(options: {
  actionType?: string;
  actorIdentifier?: string;
  from?: string;
  to?: string;
  limit?: number;
}): Promise<AuditLogRecord[]> {
  const supabase = createServerSupabaseClient();
  const limit = options.limit ?? 200;

  let query = supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(limit);

  if (options.actionType) query = query.eq('action_type', options.actionType);
  if (options.actorIdentifier) query = query.ilike('actor_identifier', `%${options.actorIdentifier}%`);
  if (options.from) query = query.gte('created_at', options.from);
  if (options.to) query = query.lte('created_at', options.to);

  const { data, error } = await query;
  if (error) throw new Error(`Failed to list audit logs: ${formatSupabaseError(error)}`);
  return ((data ?? []) as AuditLogDbRow[]).map(mapAuditLog);
}
