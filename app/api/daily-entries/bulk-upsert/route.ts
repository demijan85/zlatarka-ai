import { NextResponse } from 'next/server';
import { bulkUpsertSchema } from '@/lib/schemas/daily-entries';
import { bulkUpsertDailyEntries } from '@/lib/repositories/daily-entries';
import { IntakeMonthLockedError } from '@/lib/repositories/daily-intake-locks';

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const parsed = bulkUpsertSchema.parse(body);

    const data = await bulkUpsertDailyEntries(
      parsed.map((item) => ({
        date: item.date,
        qty: item.qty,
        fat_pct: item.fat_pct ?? null,
        supplierId: item.supplierId,
      }))
    );

    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const status = error instanceof IntakeMonthLockedError ? 423 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
