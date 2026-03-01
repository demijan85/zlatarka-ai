import { NextResponse } from 'next/server';
import { actorFromRequest } from '@/lib/audit/actor';
import { tryWriteAuditLog } from '@/lib/repositories/audit-logs';
import { deleteDailyEntry } from '@/lib/repositories/daily-entries';
import { IntakeMonthLockedError } from '@/lib/repositories/daily-intake-locks';

function parseId(params: { id: string }): number {
  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) throw new Error('Invalid daily entry id');
  return id;
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const params = await context.params;
    const id = parseId(params);
    await deleteDailyEntry(id);
    const actor = actorFromRequest(request);
    await tryWriteAuditLog({
      actionType: 'daily_entries.quality.delete',
      entityType: 'daily_entry',
      entityId: String(id),
      actorIdentifier: actor.actorIdentifier,
      actorIp: actor.actorIp,
      actorUserAgent: actor.actorUserAgent,
      metadata: {
        dailyEntryId: id,
      },
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const status = error instanceof IntakeMonthLockedError ? 423 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
