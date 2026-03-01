'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { SupplierForm } from '@/components/forms/supplier-form';
import { useTranslation } from '@/lib/i18n/use-translation';
import type { Supplier } from '@/types/domain';

async function getSuppliers(): Promise<Supplier[]> {
  const response = await fetch('/api/suppliers');
  if (!response.ok) throw new Error('Failed to fetch suppliers');
  return response.json();
}

export default function SuppliersPage() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const [editing, setEditing] = useState<Supplier | null>(null);
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

  const saveMutation = useMutation({
    mutationFn: async (payload: Partial<Supplier>) => {
      const isEdit = Boolean(editing?.id);
      const url = isEdit ? `/api/suppliers/${editing?.id}` : '/api/suppliers';
      const method = isEdit ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) throw new Error('Failed to save supplier');
      return response.json();
    },
    onSuccess: () => {
      setShowForm(false);
      setEditing(null);
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/suppliers/${id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Failed to delete supplier');
      return response.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['suppliers'] }),
  });

  const reorderMutation = useMutation({
    mutationFn: async (rows: Supplier[]) => {
      const payload = rows.map((item, index) => ({ id: item.id, order_index: index + 1 }));
      const response = await fetch('/api/suppliers/reorder', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error('Failed to reorder suppliers');
      return response.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['suppliers'] }),
  });

  function move(id: number, dir: -1 | 1) {
    const list = [...data];
    const index = list.findIndex((item) => item.id === id);
    const target = index + dir;
    if (index < 0 || target < 0 || target >= list.length) return;
    [list[index], list[target]] = [list[target], list[index]];

    reorderMutation.mutate(list);
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
              setEditing(null);
              setShowForm((prev) => !prev);
            }}
          >
            {showForm ? t('suppliers.closeForm') : t('suppliers.add')}
          </button>
        </div>
      </div>

      {showForm ? (
        <SupplierForm
          initial={editing ?? undefined}
          onCancel={() => {
            setShowForm(false);
            setEditing(null);
          }}
          onSubmit={async (values) => {
            await saveMutation.mutateAsync(values);
          }}
        />
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
              <th>{t('suppliers.bankAccount')}</th>
              <th>{t('suppliers.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={7}>{t('suppliers.loading')}</td>
              </tr>
            ) : error ? (
              <tr>
                <td colSpan={7} style={{ color: 'var(--danger)' }}>
                  {(error as Error).message}
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={7}>{t('suppliers.noData')}</td>
              </tr>
            ) : (
              filtered.map((item) => (
                <tr key={item.id}>
                  <td>{item.order_index}</td>
                  <td>{item.first_name}</td>
                  <td>{item.last_name}</td>
                  <td>{item.city ?? ''}</td>
                  <td>{item.phone ?? ''}</td>
                  <td>{item.bank_account ?? ''}</td>
                  <td>
                    <div className="control-row">
                      <button className="btn" onClick={() => move(item.id, -1)}>
                        {t('suppliers.moveUp')}
                      </button>
                      <button className="btn" onClick={() => move(item.id, 1)}>
                        {t('suppliers.moveDown')}
                      </button>
                      <button
                        className="btn"
                        onClick={() => {
                          setEditing(item);
                          setShowForm(true);
                        }}
                      >
                        {t('common.edit')}
                      </button>
                      <button
                        className="btn danger"
                        onClick={() => {
                          if (confirm(`${t('suppliers.confirmDelete')} ${item.first_name} ${item.last_name}?`)) {
                            deleteMutation.mutate(item.id);
                          }
                        }}
                      >
                        {t('common.delete')}
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
