import { NextResponse } from 'next/server';
import { listAuditLogs } from '@/lib/repositories/audit-logs';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const actionType = searchParams.get('actionType') || undefined;
    const actorIdentifier = searchParams.get('actorIdentifier') || undefined;
    const from = searchParams.get('from') || undefined;
    const to = searchParams.get('to') || undefined;
    const limitParam = searchParams.get('limit');
    const limit = limitParam ? Number(limitParam) : undefined;

    const data = await listAuditLogs({
      actionType,
      actorIdentifier,
      from,
      to,
      limit: Number.isFinite(limit ?? NaN) ? limit : undefined,
    });

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

