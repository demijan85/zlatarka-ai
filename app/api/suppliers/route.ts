import { NextResponse } from 'next/server';
import { supplierSchema } from '@/lib/schemas/suppliers';
import { createSupplier, fetchSuppliers } from '@/lib/repositories/suppliers';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const city = searchParams.get('city') ?? undefined;
    const data = await fetchSuppliers(city || undefined);
    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = supplierSchema.parse(body);
    const data = await createSupplier(parsed);
    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
