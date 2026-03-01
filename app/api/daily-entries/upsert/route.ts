import { NextResponse } from 'next/server';
import { actorFromRequest } from '@/lib/audit/actor';
import { tryWriteAuditLog } from '@/lib/repositories/audit-logs';
import { dailyEntryUpsertSchema } from '@/lib/schemas/daily-entries';
import { upsertDailyEntry } from '@/lib/repositories/daily-entries';
import { IntakeMonthLockedError } from '@/lib/repositories/daily-intake-locks';

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const parsed = dailyEntryUpsertSchema.parse(body);

    const data = await upsertDailyEntry({
      date: parsed.date,
      qty: parsed.qty,
      fat_pct: parsed.fat_pct ?? null,
      supplierId: parsed.supplierId,
    });
    const actor = actorFromRequest(request);
    await tryWriteAuditLog({
      actionType: parsed.fat_pct !== undefined ? 'daily_entries.quality.upsert' : 'daily_entries.qty.upsert',
      entityType: 'daily_entry',
      entityId: `${parsed.supplierId}:${parsed.date}`,
      actorIdentifier: actor.actorIdentifier,
      actorIp: actor.actorIp,
      actorUserAgent: actor.actorUserAgent,
      metadata: {
        supplierId: parsed.supplierId,
        date: parsed.date,
        qty: parsed.qty ?? null,
        fatPct: parsed.fat_pct ?? null,
      },
    });

    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const status = error instanceof IntakeMonthLockedError ? 423 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
