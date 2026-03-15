import { createServerSupabaseClient } from '@/lib/supabase/server';
import type { Supplier } from '@/types/domain';

type SupplierDuplicateInfo = Pick<Supplier, 'id' | 'first_name' | 'last_name' | 'hidden_in_daily_entry'>;

export class DuplicateSupplierNameError extends Error {
  duplicateSupplier: SupplierDuplicateInfo;

  constructor(duplicateSupplier: SupplierDuplicateInfo) {
    super('Supplier with the same first and last name already exists');
    this.name = 'DuplicateSupplierNameError';
    this.duplicateSupplier = duplicateSupplier;
  }
}

function isDuplicateSupplierPrimaryKeyError(message: string): boolean {
  return message.includes('suppliers_pkey') || message.includes('duplicate key value');
}

function normalizeNamePart(value: string | null | undefined): string {
  return (value ?? '').trim().replace(/\s+/g, ' ').toLocaleLowerCase();
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

async function getSupplierById(id: number): Promise<Supplier | null> {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase.from('suppliers').select('*').eq('id', id).maybeSingle();
  if (error) throw new Error(`Failed to fetch supplier ${id}: ${error.message}`);
  return (data as Supplier | null) ?? null;
}

async function findSupplierByFullName(
  firstName: string,
  lastName: string,
  excludeId?: number
): Promise<SupplierDuplicateInfo | null> {
  const normalizedFirstName = normalizeNamePart(firstName);
  const normalizedLastName = normalizeNamePart(lastName);

  if (!normalizedFirstName || !normalizedLastName) return null;

  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from('suppliers')
    .select('id, first_name, last_name, hidden_in_daily_entry');

  if (error) throw new Error(`Failed to check supplier duplicates: ${error.message}`);

  const duplicate = ((data ?? []) as SupplierDuplicateInfo[]).find((supplier) => {
    if (excludeId && supplier.id === excludeId) return false;
    return (
      normalizeNamePart(supplier.first_name) === normalizedFirstName &&
      normalizeNamePart(supplier.last_name) === normalizedLastName
    );
  });

  return duplicate ?? null;
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
  const duplicate = await findSupplierByFullName(insertPayload.first_name ?? '', insertPayload.last_name ?? '');
  if (duplicate) throw new DuplicateSupplierNameError(duplicate);

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
  if (payload.first_name !== undefined || payload.last_name !== undefined) {
    const current = await getSupplierById(id);
    if (!current) throw new Error(`Supplier ${id} not found`);

    const nextFirstName = payload.first_name ?? current.first_name;
    const nextLastName = payload.last_name ?? current.last_name;
    const duplicate = await findSupplierByFullName(nextFirstName, nextLastName, id);
    if (duplicate) throw new DuplicateSupplierNameError(duplicate);
  }

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
