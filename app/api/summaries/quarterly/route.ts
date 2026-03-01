import { NextResponse } from 'next/server';
import { getEffectiveCalculationConstantsForYearMonth } from '@/lib/repositories/calculation-constants';
import { getQuarterlySummaries } from '@/lib/repositories/summaries';
import { parseQuarter, parseYear } from '@/lib/utils/date';
import { yearMonthFrom } from '@/lib/utils/year-month';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const now = new Date();
    const currentQuarter = Math.floor(now.getMonth() / 3) + 1;
    const year = parseYear(searchParams.get('year'), now.getFullYear());
    const quarter = parseQuarter(searchParams.get('quarter'), currentQuarter);
    const startMonth = (quarter - 1) * 3 + 1;

    const constants = await getEffectiveCalculationConstantsForYearMonth(yearMonthFrom(year, startMonth));
    const data = await getQuarterlySummaries({ year, quarter, constants });
    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
