import { NextResponse } from 'next/server';
import { reorderSuppliers } from '@/lib/repositories/suppliers';
import { z } from 'zod';

const reorderSchema = z.array(
  z.object({
    id: z.coerce.number().int().positive(),
    order_index: z.coerce.number().int().nonnegative(),
  })
);

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const parsed = reorderSchema.parse(body);
    await reorderSuppliers(parsed);
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
