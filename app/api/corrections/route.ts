import { NextResponse } from 'next/server';
import { actorFromRequest } from '@/lib/audit/actor';
import { tryWriteAuditLog } from '@/lib/repositories/audit-logs';
import { createCorrectionRequest, listCorrectionRequests } from '@/lib/repositories/correction-requests';
import { correctionRequestCreateSchema } from '@/lib/schemas/corrections';
import type { CorrectionRequestStatus } from '@/types/domain';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const yearMonth = searchParams.get('yearMonth') || undefined;
    const statusParam = searchParams.get('status');
    const status =
      statusParam === 'pending' || statusParam === 'approved' || statusParam === 'rejected'
        ? (statusParam as CorrectionRequestStatus)
        : undefined;
    const supplierIdParam = searchParams.get('supplierId');
    const supplierId = supplierIdParam ? Number(supplierIdParam) : undefined;
    const limitParam = searchParams.get('limit');
    const limit = limitParam ? Number(limitParam) : undefined;

    const data = await listCorrectionRequests({
      yearMonth,
      status,
      supplierId: Number.isFinite(supplierId ?? NaN) ? supplierId : undefined,
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

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = correctionRequestCreateSchema.parse(body);
    const actor = actorFromRequest(request);

    const data = await createCorrectionRequest({
      yearMonth: parsed.yearMonth,
      supplierId: parsed.supplierId,
      entryDate: parsed.entryDate,
      fieldName: parsed.fieldName,
      requestedValue: parsed.requestedValue,
      reason: parsed.reason,
      requestedBy: actor.actorIdentifier,
    });

    await tryWriteAuditLog({
      actionType: 'daily_entries.correction.requested',
      entityType: 'correction_request',
      entityId: String(data.id),
      actorIdentifier: actor.actorIdentifier,
      actorIp: actor.actorIp,
      actorUserAgent: actor.actorUserAgent,
      metadata: {
        yearMonth: data.yearMonth,
        supplierId: data.supplierId,
        entryDate: data.entryDate,
        fieldName: data.fieldName,
        requestedValue: data.requestedValue,
      },
    });

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
