import { NextResponse } from 'next/server';
import { deleteCalculationConstantVersion } from '@/lib/repositories/calculation-constants';

export async function DELETE(_: Request, context: { params: Promise<{ validFrom: string }> }) {
  try {
    const { validFrom } = await context.params;
    await deleteCalculationConstantVersion(decodeURIComponent(validFrom));
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
