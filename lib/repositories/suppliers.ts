import { createServerSupabaseClient } from '@/lib/supabase/server';
import type { Supplier } from '@/types/domain';

export async function fetchSuppliers(city?: string): Promise<Supplier[]> {
  const supabase = createServerSupabaseClient();
  let query = supabase.from('suppliers').select('*').order('order_index', { ascending: true });
  if (city) query = query.eq('city', city);

  const { data, error } = await query;
  if (error) throw new Error(`Failed to fetch suppliers: ${error.message}`);
  return (data ?? []) as Supplier[];
}

export async function createSupplier(payload: Partial<Supplier>): Promise<Supplier> {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase.from('suppliers').insert(payload).select('*').single();
  if (error) throw new Error(`Failed to create supplier: ${error.message}`);
  return data as Supplier;
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
