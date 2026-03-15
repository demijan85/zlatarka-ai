import { NextResponse } from 'next/server';
import { monthlySummaryOverrideSchema } from '@/lib/schemas/monthly-summary-overrides';
import { upsertMonthlySummaryOverride } from '@/lib/repositories/monthly-summary-overrides';

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const parsed = monthlySummaryOverrideSchema.parse(body);
    const data = await upsertMonthlySummaryOverride(parsed);
    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
