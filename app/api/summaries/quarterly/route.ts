import { NextResponse } from 'next/server';
import { getQuarterlySummarySnapshot } from '@/lib/repositories/summaries';
import { parseQuarter, parseYear } from '@/lib/utils/date';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const now = new Date();
    const currentQuarter = Math.floor(now.getMonth() / 3) + 1;
    const year = parseYear(searchParams.get('year'), now.getFullYear());
    const quarter = parseQuarter(searchParams.get('quarter'), currentQuarter);

    const data = await getQuarterlySummarySnapshot({ year, quarter });
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
