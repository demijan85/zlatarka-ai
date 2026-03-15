import { createServerSupabaseClient } from '@/lib/supabase/server';
import type { Supplier } from '@/types/domain';

function isDuplicateSupplierPrimaryKeyError(message: string): boolean {
  return message.includes('suppliers_pkey') || message.includes('duplicate key value');
}

async function getNextSupplierId(): Promise<number> {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from('suppliers')
    .select('id')
    .order('id', { ascending: false })
    .limit(1)
    .maybeSingle<{ id: number }>();

  if (error) throw new Error(`Failed to reserve supplier id: ${error.message}`);
  return (data?.id ?? 0) + 1;
}

export async function fetchSuppliers(city?: string): Promise<Supplier[]> {
  const supabase = createServerSupabaseClient();
  let query = supabase.from('suppliers').select('*').order('order_index', { ascending: true });
  if (city) query = query.eq('city', city);

  const { data, error } = await query;
  if (error) throw new Error(`Failed to fetch suppliers: ${error.message}`);
  return (data ?? []) as Supplier[];
}

export async function createSupplier(payload: Partial<Supplier>): Promise<Supplier> {
  const { id: _ignoredId, ...insertPayload } = payload;
  const supabase = createServerSupabaseClient();
  const nextId = await getNextSupplierId();

  const { data, error } = await supabase
    .from('suppliers')
    .insert({ ...insertPayload, id: nextId })
    .select('*')
    .single();

  if (!error) return data as Supplier;
  if (!isDuplicateSupplierPrimaryKeyError(error.message)) {
    throw new Error(`Failed to create supplier: ${error.message}`);
  }

  const retryId = await getNextSupplierId();
  const { data: retryData, error: retryError } = await supabase
    .from('suppliers')
    .insert({ ...insertPayload, id: retryId })
    .select('*')
    .single();

  if (retryError) throw new Error(`Failed to create supplier: ${retryError.message}`);
  return retryData as Supplier;
}

export async function updateSupplier(id: number, payload: Partial<Supplier>): Promise<Supplier> {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from('suppliers')
    .update(payload)
    .eq('id', id)
    .select('*')
    .single();

  if (error) throw new Error(`Failed to update supplier ${id}: ${error.message}`);
  return data as Supplier;
}

export async function deleteSupplier(id: number): Promise<void> {
  const supabase = createServerSupabaseClient();
  const { error } = await supabase.from('suppliers').delete().eq('id', id);
  if (error) throw new Error(`Failed to delete supplier ${id}: ${error.message}`);
}

export async function reorderSuppliers(
  items: Array<{ id: number; order_index: number }>
): Promise<void> {
  const supabase = createServerSupabaseClient();

  for (const item of items) {
    const { error } = await supabase
      .from('suppliers')
      .update({ order_index: item.order_index })
      .eq('id', item.id);

    if (error) {
      throw new Error(`Failed to reorder supplier ${item.id}: ${error.message}`);
    }
  }
}
