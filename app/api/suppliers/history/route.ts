import { NextResponse } from 'next/server';
import { getSupplierHistory } from '@/lib/repositories/supplier-history';
import { parseYear } from '@/lib/utils/date';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const supplierId = Number(searchParams.get('supplierId'));
    const year = parseYear(searchParams.get('year'), new Date().getFullYear());

    if (!Number.isInteger(supplierId) || supplierId <= 0) {
      throw new Error('Invalid supplierId');
    }

    const data = await getSupplierHistory(supplierId, year);
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
