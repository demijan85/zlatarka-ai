import { NextResponse } from 'next/server';
import { deleteDailyEntry } from '@/lib/repositories/daily-entries';
import { IntakeMonthLockedError } from '@/lib/repositories/daily-intake-locks';

function parseId(params: { id: string }): number {
  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) throw new Error('Invalid daily entry id');
  return id;
}

export async function DELETE(_: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const params = await context.params;
    await deleteDailyEntry(parseId(params));
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const status = error instanceof IntakeMonthLockedError ? 423 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
