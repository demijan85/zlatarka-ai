import { NextResponse } from 'next/server';
import { getEffectiveCalculationConstantsForYearMonth } from '@/lib/repositories/calculation-constants';
import { getMonthlySummaries } from '@/lib/repositories/summaries';
import { parseMonth, parseYear } from '@/lib/utils/date';
import { normalizePeriod } from '@/lib/utils/period';
import { yearMonthFrom } from '@/lib/utils/year-month';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const now = new Date();
    const year = parseYear(searchParams.get('year'), now.getFullYear());
    const month = parseMonth(searchParams.get('month'), now.getMonth() + 1);
    const period = normalizePeriod(searchParams.get('period'));
    const city = searchParams.get('city') || undefined;

    const constants = await getEffectiveCalculationConstantsForYearMonth(yearMonthFrom(year, month));
    const data = await getMonthlySummaries({ year, month, city, period, constants });
    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'private, max-age=10, stale-while-revalidate=30',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
