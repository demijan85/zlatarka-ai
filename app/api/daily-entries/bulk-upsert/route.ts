import { NextResponse } from 'next/server';
import { bulkUpsertSchema } from '@/lib/schemas/daily-entries';
import { bulkUpsertDailyEntries } from '@/lib/repositories/daily-entries';

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
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
