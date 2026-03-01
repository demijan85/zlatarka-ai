import { NextResponse } from 'next/server';
import { constantsFromSearchParams } from '@/lib/constants/from-request';
import { getQuarterlySummaries } from '@/lib/repositories/summaries';
import { parseQuarter, parseYear } from '@/lib/utils/date';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const now = new Date();
    const currentQuarter = Math.floor(now.getMonth() / 3) + 1;
    const year = parseYear(searchParams.get('year'), now.getFullYear());
    const quarter = parseQuarter(searchParams.get('quarter'), currentQuarter);
    const constants = constantsFromSearchParams(searchParams);

    const data = await getQuarterlySummaries({ year, quarter, constants });
    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
