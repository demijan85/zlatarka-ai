import { NextResponse } from 'next/server';
import { actorFromRequest } from '@/lib/audit/actor';
import { tryWriteAuditLog } from '@/lib/repositories/audit-logs';
import { reviewCorrectionRequest } from '@/lib/repositories/correction-requests';
import { correctionRequestReviewSchema } from '@/lib/schemas/corrections';

function parseId(raw: string): number {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) {
    throw new Error('Invalid correction request id');
  }
  return id;
}

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const params = await context.params;
    const id = parseId(params.id);
    const body = await request.json();
    const parsed = correctionRequestReviewSchema.parse(body);
    const actor = actorFromRequest(request);

    const data = await reviewCorrectionRequest({
      id,
      status: parsed.status,
      reviewNote: parsed.reviewNote,
      reviewedBy: actor.actorIdentifier,
    });

    await tryWriteAuditLog({
      actionType: parsed.status === 'approved' ? 'daily_entries.correction.approved' : 'daily_entries.correction.rejected',
      entityType: 'correction_request',
      entityId: String(id),
      actorIdentifier: actor.actorIdentifier,
      actorIp: actor.actorIp,
      actorUserAgent: actor.actorUserAgent,
      metadata: {
        status: parsed.status,
        reviewNote: parsed.reviewNote ?? null,
        appliedEntryId: data.appliedEntryId,
      },
    });

    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

