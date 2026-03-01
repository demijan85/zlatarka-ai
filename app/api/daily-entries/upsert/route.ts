import { NextResponse } from 'next/server';
import { dailyEntryUpsertSchema } from '@/lib/schemas/daily-entries';
import { upsertDailyEntry } from '@/lib/repositories/daily-entries';

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

    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
