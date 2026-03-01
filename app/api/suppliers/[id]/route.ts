import { NextResponse } from 'next/server';
import { supplierUpdateSchema } from '@/lib/schemas/suppliers';
import { deleteSupplier, updateSupplier } from '@/lib/repositories/suppliers';

function parseId(params: { id: string }): number {
  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) throw new Error('Invalid supplier id');
  return id;
}

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const params = await context.params;
    const id = parseId(params);
    const body = await request.json();
    const parsed = supplierUpdateSchema.parse(body);
    const data = await updateSupplier(id, parsed);
    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(_: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const params = await context.params;
    const id = parseId(params);
    await deleteSupplier(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
