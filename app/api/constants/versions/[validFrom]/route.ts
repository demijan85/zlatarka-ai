import { NextResponse } from 'next/server';
import { actorFromRequest } from '@/lib/audit/actor';
import { tryWriteAuditLog } from '@/lib/repositories/audit-logs';
import { deleteCalculationConstantVersion } from '@/lib/repositories/calculation-constants';

export async function DELETE(request: Request, context: { params: Promise<{ validFrom: string }> }) {
  try {
    const { validFrom } = await context.params;
    const normalizedValidFrom = decodeURIComponent(validFrom);
    await deleteCalculationConstantVersion(normalizedValidFrom);
    const actor = actorFromRequest(request);
    await tryWriteAuditLog({
      actionType: 'settings.constants.delete_version',
      entityType: 'calculation_constants_version',
      entityId: normalizedValidFrom,
      actorIdentifier: actor.actorIdentifier,
      actorIp: actor.actorIp,
      actorUserAgent: actor.actorUserAgent,
      metadata: {
        validFrom: normalizedValidFrom,
      },
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
