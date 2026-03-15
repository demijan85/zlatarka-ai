'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { SupplierForm, type SupplierFormValues } from '@/components/forms/supplier-form';
import { ConfirmDialog } from '@/components/layout/confirm-dialog';
import { useTranslation } from '@/lib/i18n/use-translation';
import type { Supplier } from '@/types/domain';

type DuplicateSupplierInfo = Pick<Supplier, 'id' | 'first_name' | 'last_name' | 'hidden_in_daily_entry'>;

class DuplicateSupplierClientError extends Error {
  duplicateSupplier: DuplicateSupplierInfo;

  constructor(duplicateSupplier: DuplicateSupplierInfo) {
    super('Supplier with the same first and last name already exists');
    this.name = 'DuplicateSupplierClientError';
    this.duplicateSupplier = duplicateSupplier;
  }
}

async function getSuppliers(): Promise<Supplier[]> {
  const response = await fetch('/api/suppliers', { cache: 'no-store' });
  if (!response.ok) throw new Error('Failed to fetch suppliers');
  return response.json();
}

async function parseResponseError(response: Response, fallback: string): Promise<Error> {
  try {
    const parsed = (await response.json()) as { error?: string; duplicateSupplier?: DuplicateSupplierInfo };
    if (parsed.duplicateSupplier) return new DuplicateSupplierClientError(parsed.duplicateSupplier);
    if (parsed.error) return new Error(parsed.error);
  } catch {
    // ignore non-json response
  }

  return new Error(fallback);
}

function normalizeSupplierPayload(payload: Partial<Supplier>): Partial<Supplier> {
  return {
    ...payload,
    first_name: payload.first_name?.trim() ?? '',
    last_name: payload.last_name?.trim() ?? '',
    phone: payload.phone?.trim() || null,
    email: payload.email?.trim() || null,
    jmbg: payload.jmbg?.trim() || null,
    agriculture_number: payload.agriculture_number?.trim() || null,
    bank_account: payload.bank_account?.trim() || null,
    street: payload.street?.trim() || null,
    city: payload.city?.trim() ?? '',
    country: 'Srbija',
    zip_code: payload.zip_code?.trim() || null,
  };
}

export default function SuppliersPage() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const [actionError, setActionError] = useState('');
  const [actionInfo, setActionInfo] = useState('');
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [supplierToDelete, setSupplierToDelete] = useState<Supplier | null>(null);
  const [duplicateHiddenSupplier, setDuplicateHiddenSupplier] = useState<DuplicateSupplierInfo | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [cityFilter, setCityFilter] = useState('');

  const { data = [], isLoading, error } = useQuery({ queryKey: ['suppliers'], queryFn: getSuppliers });

  const filtered = useMemo(
    () => (cityFilter ? data.filter((item) => item.city === cityFilter) : data),
    [cityFilter, data]
  );

  const cities = useMemo(
    () => [...new Set(data.map((item) => item.city).filter(Boolean))] as string[],
    [data]
  );

  const createDefaults = useMemo<Partial<SupplierFormValues>>(() => {
    const maxOrder = data.reduce((max, supplier) => Math.max(max, supplier.order_index ?? 0), 0);
    return { order_index: maxOrder + 1 };
  }, [data]);

  const formInitialValues = useMemo<Partial<SupplierFormValues>>(() => {
    if (!editing) return createDefaults;

    return {
      ...editing,
      phone: editing.phone ?? '',
      email: editing.email ?? '',
      jmbg: editing.jmbg ?? '',
      agriculture_number: editing.agriculture_number ?? '',
      bank_account: editing.bank_account ?? '',
      street: editing.street ?? '',
      city: editing.city ?? '',
      country: editing.country ?? 'Srbija',
      zip_code: editing.zip_code ?? '',
    };
  }, [createDefaults, editing]);

  useEffect(() => {
    if (!showForm) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [showForm]);

  const saveMutation = useMutation({
    mutationFn: async (payload: Partial<Supplier>) => {
      const isEdit = Boolean(editing?.id);
      const url = isEdit ? `/api/suppliers/${editing?.id}` : '/api/suppliers';
      const method = isEdit ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(normalizeSupplierPayload(payload)),
      });

      if (!response.ok) throw await parseResponseError(response, 'Failed to save supplier');
      return response.json();
    },
    onSuccess: () => {
      setActionError('');
      setActionInfo('');
      setShowForm(false);
      setEditing(null);
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
    },
    onError: (error) => {
      if (error instanceof DuplicateSupplierClientError) {
        if (error.duplicateSupplier.hidden_in_daily_entry) {
          setActionError('');
          setDuplicateHiddenSupplier(error.duplicateSupplier);
          return;
        }

        setActionInfo('');
        setActionError(t('suppliers.duplicateExists'));
        return;
      }

      setActionInfo('');
      setActionError(error instanceof Error ? error.message : 'Failed to save supplier');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/suppliers/${id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Failed to delete supplier');
      return response.json();
    },
    onSuccess: () => {
      setActionError('');
      setActionInfo('');
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
    },
  });

  const visibilityMutation = useMutation({
    mutationFn: async ({ id, hidden }: { id: number; hidden: boolean }) => {
      const response = await fetch(`/api/suppliers/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hidden_in_daily_entry: hidden }),
      });
      if (!response.ok) throw new Error('Failed to update supplier visibility');
      return response.json();
    },
    onSuccess: () => {
      setActionError('');
      setActionInfo('');
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
    },
    onError: (error) => {
      setActionInfo('');
      setActionError(error instanceof Error ? error.message : 'Failed to update supplier visibility');
    },
  });

  const reorderMutation = useMutation({
    mutationFn: async (rows: Supplier[]) => {
      const payload = rows.map((item, index) => ({ id: item.id, order_index: index + 1 }));
      const response = await fetch('/api/suppliers/reorder', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? 'Failed to reorder suppliers');
      }
      return response.json();
    },
    onMutate: async (rows) => {
      await queryClient.cancelQueries({ queryKey: ['suppliers'] });
      const previous = queryClient.getQueryData<Supplier[]>(['suppliers']);
      const optimisticRows = rows.map((item, index) => ({
        ...item,
        order_index: index + 1,
      }));
      queryClient.setQueryData(['suppliers'], optimisticRows);
      return { previous };
    },
    onError: (error, _rows, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['suppliers'], context.previous);
      }
      setActionInfo('');
      setActionError(error instanceof Error ? error.message : 'Failed to reorder suppliers');
    },
    onSuccess: () => {
      setActionError('');
      setActionInfo('');
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
    },
  });

  function closeForm() {
    setShowForm(false);
    setEditing(null);
    setDuplicateHiddenSupplier(null);
  }

  function openCreateForm() {
    setEditing(null);
    setShowForm(true);
  }

  function openEditForm(item: Supplier) {
    setEditing(item);
    setShowForm(true);
  }

  function move(id: number, dir: -1 | 1) {
    const visibleList = filtered;
    const visibleIndex = visibleList.findIndex((item) => item.id === id);
    const targetVisibleIndex = visibleIndex + dir;
    if (visibleIndex < 0 || targetVisibleIndex < 0 || targetVisibleIndex >= visibleList.length) return;

    const targetId = visibleList[targetVisibleIndex]?.id;
    const list = [...data];
    const index = list.findIndex((item) => item.id === id);
    const target = list.findIndex((item) => item.id === targetId);
    if (index < 0 || target < 0) return;

    [list[index], list[target]] = [list[target], list[index]];

    reorderMutation.mutate(list);
  }

  function getMissingSupplierFields(item: Supplier): string[] {
    const missing: string[] = [];
    if (!item.agriculture_number) missing.push(t('suppliers.agricultureNumber'));
    if (!item.jmbg) missing.push(t('suppliers.jmbg'));
    if (!item.bank_account) missing.push(t('suppliers.bankAccount'));
    return missing;
  }

  function normalizeNamePart(value: string | null | undefined): string {
    return (value ?? '').trim().replace(/\s+/g, ' ').toLocaleLowerCase();
  }

  function findDuplicateSupplier(values: Partial<SupplierFormValues>): DuplicateSupplierInfo | null {
    const normalizedFirstName = normalizeNamePart(values.first_name);
    const normalizedLastName = normalizeNamePart(values.last_name);
    if (!normalizedFirstName || !normalizedLastName) return null;

    return (
      data.find((supplier) => {
        if (editing?.id && supplier.id === editing.id) return false;
        return (
          normalizeNamePart(supplier.first_name) === normalizedFirstName &&
          normalizeNamePart(supplier.last_name) === normalizedLastName
        );
      }) ?? null
    );
  }

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div className="card" style={{ padding: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0 }}>{t('suppliers.title')}</h2>
        <div className="control-row">
          <select className="input" value={cityFilter} onChange={(e) => setCityFilter(e.target.value)}>
            <option value="">{t('common.allCities')}</option>
            {cities.map((city) => (
              <option key={city} value={city}>
                {city}
              </option>
            ))}
          </select>
          <button
            className="btn primary"
            onClick={() => {
              if (showForm) {
                closeForm();
                return;
              }

              openCreateForm();
            }}
          >
            {showForm ? t('common.close') : t('suppliers.add')}
          </button>
        </div>
      </div>

      {actionError ? (
        <div className="card" style={{ padding: 12, color: 'var(--danger)' }}>
          {actionError}
        </div>
      ) : null}

      {actionInfo ? (
        <div className="card" style={{ padding: 12, color: 'var(--accent-700)' }}>
          {actionInfo}
        </div>
      ) : null}

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>{t('suppliers.order')}</th>
              <th>{t('suppliers.firstName')}</th>
              <th>{t('suppliers.lastName')}</th>
              <th>{t('suppliers.city')}</th>
              <th>{t('suppliers.phone')}</th>
              <th>{t('suppliers.cows')}</th>
              <th>{t('suppliers.dailyEntry')}</th>
              <th>{t('suppliers.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={8}>{t('suppliers.loading')}</td>
              </tr>
            ) : error ? (
              <tr>
                <td colSpan={8} style={{ color: 'var(--danger)' }}>
                  {(error as Error).message}
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={8}>{t('suppliers.noData')}</td>
              </tr>
            ) : (
              filtered.map((item) => {
                const missingFields = getMissingSupplierFields(item);
                const rowTooltip = missingFields.length
                  ? `${t('suppliers.missingFieldsTooltip')}: ${missingFields.join(', ')}`
                  : '';

                return (
                <tr
                  key={item.id}
                  className={missingFields.length ? 'data-row-missing' : undefined}
                >
                  <td className="supplier-row-order-cell">
                    {item.order_index}
                    {missingFields.length ? <div className="supplier-row-tooltip">{rowTooltip}</div> : null}
                  </td>
                  <td>{item.first_name}</td>
                  <td>{item.last_name}</td>
                  <td>{item.city ?? ''}</td>
                  <td>{item.phone ?? ''}</td>
                  <td>{item.number_of_cows ?? ''}</td>
                  <td>
                    <span className="badge">
                      {item.hidden_in_daily_entry ? t('suppliers.hiddenInDailyEntry') : t('suppliers.visibleInDailyEntry')}
                    </span>
                  </td>
                  <td>
                    <div className="control-row">
                      <button
                        className="btn icon-btn"
                        onClick={() => move(item.id, -1)}
                        disabled={reorderMutation.isPending || filtered[0]?.id === item.id}
                        aria-label={t('suppliers.moveUp')}
                        title={t('suppliers.moveUp')}
                      >
                        <span aria-hidden="true">&uarr;</span>
                      </button>
                      <button
                        className="btn icon-btn"
                        onClick={() => move(item.id, 1)}
                        disabled={reorderMutation.isPending || filtered[filtered.length - 1]?.id === item.id}
                        aria-label={t('suppliers.moveDown')}
                        title={t('suppliers.moveDown')}
                      >
                        <span aria-hidden="true">&darr;</span>
                      </button>
                      <button
                        className="btn"
                        onClick={() => {
                          openEditForm(item);
                        }}
                      >
                        {t('common.edit')}
                      </button>
                      <button
                        className="btn"
                        onClick={() => visibilityMutation.mutate({ id: item.id, hidden: !item.hidden_in_daily_entry })}
                        disabled={visibilityMutation.isPending}
                      >
                        {item.hidden_in_daily_entry ? t('daily.showSupplier') : t('daily.hideSupplier')}
                      </button>
                      <button
                        className="btn danger"
                        onClick={() => {
                          setSupplierToDelete(item);
                        }}
                      >
                        {t('common.delete')}
                      </button>
                    </div>
                  </td>
                </tr>
              )})
            )}
          </tbody>
        </table>
      </div>

      {showForm ? (
        <div className="modal-backdrop" onClick={closeForm}>
          <div
            className="modal-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="supplier-form-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-header">
              <div style={{ display: 'grid', gap: 4 }}>
                <h3 id="supplier-form-title" style={{ margin: 0 }}>
                  {editing ? t('common.edit') : t('suppliers.add')}
                </h3>
                <div className="muted">
                  {editing
                    ? `${editing.first_name} ${editing.last_name}`
                    : t('suppliers.saveSupplier')}
                </div>
              </div>
              <button className="btn" type="button" onClick={closeForm}>
                {t('common.close')}
              </button>
            </div>

            <SupplierForm
              initial={formInitialValues}
              onCancel={closeForm}
              onSubmit={async (values) => {
                const duplicate = findDuplicateSupplier(values);
                if (duplicate) {
                  if (duplicate.hidden_in_daily_entry) {
                    setActionError('');
                    setActionInfo('');
                    setDuplicateHiddenSupplier(duplicate);
                    return;
                  }

                  setActionInfo('');
                  setActionError(t('suppliers.duplicateExists'));
                  return;
                }

                await saveMutation.mutateAsync(values).catch(() => undefined);
              }}
            />
          </div>
        </div>
      ) : null}

      <ConfirmDialog
        open={Boolean(supplierToDelete)}
        title={t('suppliers.confirmDelete')}
        message={
          supplierToDelete
            ? `${supplierToDelete.first_name} ${supplierToDelete.last_name}`
            : ''
        }
        tone="danger"
        confirmLabel={t('common.delete')}
        busy={deleteMutation.isPending}
        onCancel={() => setSupplierToDelete(null)}
        onConfirm={() => {
          if (!supplierToDelete) return;
          deleteMutation.mutate(supplierToDelete.id, {
            onSuccess: () => {
              setSupplierToDelete(null);
              queryClient.invalidateQueries({ queryKey: ['suppliers'] });
            },
            onError: () => {
              setSupplierToDelete(null);
            },
          });
        }}
      />

      <ConfirmDialog
        open={Boolean(duplicateHiddenSupplier)}
        title={t('suppliers.duplicateTitle')}
        message={
          duplicateHiddenSupplier
            ? `${duplicateHiddenSupplier.first_name} ${duplicateHiddenSupplier.last_name}. ${t('suppliers.duplicateHiddenExists')}`
            : t('suppliers.duplicateHiddenExists')
        }
        confirmLabel={t('suppliers.activateExisting')}
        busy={visibilityMutation.isPending}
        onCancel={() => setDuplicateHiddenSupplier(null)}
        onConfirm={() => {
          if (!duplicateHiddenSupplier) return;

          visibilityMutation.mutate(
            { id: duplicateHiddenSupplier.id, hidden: false },
            {
              onSuccess: () => {
                setActionError('');
                setActionInfo(t('suppliers.reactivated'));
                setDuplicateHiddenSupplier(null);
                setShowForm(false);
                setEditing(null);
                queryClient.invalidateQueries({ queryKey: ['suppliers'] });
              },
              onError: () => {
                setDuplicateHiddenSupplier(null);
              },
            }
          );
        }}
      />
    </div>
  );
}
