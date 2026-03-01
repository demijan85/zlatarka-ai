import { NextResponse } from 'next/server';
import { actorFromRequest } from '@/lib/audit/actor';
import { tryWriteAuditLog } from '@/lib/repositories/audit-logs';
import { dailyIntakeLockSchema } from '@/lib/schemas/daily-entries';
import { getDailyIntakeLock, setDailyIntakeLock } from '@/lib/repositories/daily-intake-locks';
import { parseMonth, parseYear } from '@/lib/utils/date';
import { yearMonthFrom } from '@/lib/utils/year-month';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const now = new Date();
    const year = parseYear(searchParams.get('year'), now.getFullYear());
    const month = parseMonth(searchParams.get('month'), now.getMonth() + 1);
    const yearMonth = yearMonthFrom(year, month);

    const data = await getDailyIntakeLock(yearMonth);
    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const parsed = dailyIntakeLockSchema.parse(body);

    const data = await setDailyIntakeLock(parsed.yearMonth, parsed.isLocked);
    const actor = actorFromRequest(request);
    await tryWriteAuditLog({
      actionType: parsed.isLocked ? 'daily_intake.lock' : 'daily_intake.unlock',
      entityType: 'daily_intake_month',
      entityId: parsed.yearMonth,
      actorIdentifier: actor.actorIdentifier,
      actorIp: actor.actorIp,
      actorUserAgent: actor.actorUserAgent,
      metadata: {
        yearMonth: parsed.yearMonth,
        isLocked: parsed.isLocked,
      },
    });
    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
