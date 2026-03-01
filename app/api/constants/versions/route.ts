import { NextResponse } from 'next/server';
import { versionedCalculationConstantsSchema } from '@/lib/constants/calculation';
import {
  listCalculationConstantVersions,
  upsertCalculationConstantVersion,
} from '@/lib/repositories/calculation-constants';

export async function GET() {
  try {
    const data = await listCalculationConstantVersions();
    return NextResponse.json(data);
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
    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
