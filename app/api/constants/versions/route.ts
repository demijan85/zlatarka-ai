import { NextResponse } from 'next/server';
import { actorFromRequest } from '@/lib/audit/actor';
import { versionedCalculationConstantsSchema } from '@/lib/constants/calculation';
import { tryWriteAuditLog } from '@/lib/repositories/audit-logs';
import {
  listCalculationConstantVersions,
  upsertCalculationConstantVersion,
} from '@/lib/repositories/calculation-constants';

export async function GET() {
  try {
    const data = await listCalculationConstantVersions();
    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'private, max-age=30, stale-while-revalidate=120',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const parsed = versionedCalculationConstantsSchema.parse(body);
    const data = await upsertCalculationConstantVersion(parsed);
    const actor = actorFromRequest(request);
    await tryWriteAuditLog({
      actionType: 'settings.constants.upsert_version',
      entityType: 'calculation_constants_version',
      entityId: data.validFrom,
      actorIdentifier: actor.actorIdentifier,
      actorIp: actor.actorIp,
      actorUserAgent: actor.actorUserAgent,
      metadata: {
        validFrom: data.validFrom,
        pricePerFatPct: data.pricePerFatPct,
        taxPercentage: data.taxPercentage,
        stimulationLowThreshold: data.stimulationLowThreshold,
        stimulationHighThreshold: data.stimulationHighThreshold,
        stimulationLowAmount: data.stimulationLowAmount,
        stimulationHighAmount: data.stimulationHighAmount,
        premiumPerLiter: data.premiumPerLiter,
      },
    });
    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
