import { NextResponse } from 'next/server';
import { dailyEntrySchema } from '@/lib/schemas/daily-entries';
import { getDailyEntriesForMonth, upsertDailyEntry } from '@/lib/repositories/daily-entries';
import { parseMonth, parseYear } from '@/lib/utils/date';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const now = new Date();
    const year = parseYear(searchParams.get('year'), now.getFullYear());
    const month = parseMonth(searchParams.get('month'), now.getMonth() + 1);

    const data = await getDailyEntriesForMonth(year, month);
    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = dailyEntrySchema.parse(body);
    const data = await upsertDailyEntry({
      date: parsed.date,
      qty: parsed.qty,
      fat_pct: parsed.fat_pct ?? null,
      supplierId: parsed.supplierId,
    });
    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
