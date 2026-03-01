import { createServerSupabaseClient } from '@/lib/supabase/server';

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
