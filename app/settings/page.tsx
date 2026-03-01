'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  defaultCalculationConstants,
  defaultVersionedConstants,
  getEffectiveConstantsForPeriod,
  sortVersions,
  versionedCalculationConstantsSchema,
  type VersionedCalculationConstants,
} from '@/lib/constants/calculation';
import { useTranslation } from '@/lib/i18n/use-translation';
import { yearMonthFrom } from '@/lib/utils/year-month';

function currentYearMonth(): string {
  const now = new Date();
  return yearMonthFrom(now.getFullYear(), now.getMonth() + 1);
}

async function readError(response: Response, fallback: string): Promise<Error> {
  try {
    const parsed = (await response.json()) as { error?: string };
    if (parsed.error) return new Error(parsed.error);
  } catch {
    // ignore parse errors
  }
  return new Error(fallback);
}

async function fetchVersions(): Promise<VersionedCalculationConstants[]> {
  const response = await fetch('/api/constants/versions');
  if (!response.ok) throw await readError(response, 'Failed to fetch constants versions');
  return response.json();
}

export default function SettingsPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [selectedYearMonth, setSelectedYearMonth] = useState(currentYearMonth());
  const [editingValidFrom, setEditingValidFrom] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  const { data: versionsData = [], isLoading, error } = useQuery({
    queryKey: ['constants-versions'],
    queryFn: fetchVersions,
  });

  const orderedVersions = useMemo(
    () => sortVersions(versionsData.length ? versionsData : [defaultVersionedConstants]),
    [versionsData]
  );

  const activeVersion = useMemo(
    () => getEffectiveConstantsForPeriod(orderedVersions, selectedYearMonth),
    [orderedVersions, selectedYearMonth]
  );

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<VersionedCalculationConstants>({
    resolver: zodResolver(versionedCalculationConstantsSchema),
    defaultValues: activeVersion,
  });

  useEffect(() => {
    if (editingValidFrom) {
      const editTarget = orderedVersions.find((item) => item.validFrom === editingValidFrom);
      if (editTarget) {
        reset(editTarget);
        return;
      }
      setEditingValidFrom(null);
    }

    reset({ ...activeVersion, validFrom: selectedYearMonth });
  }, [editingValidFrom, orderedVersions, activeVersion, selectedYearMonth, reset]);

  const saveMutation = useMutation({
    mutationFn: async (values: VersionedCalculationConstants) => {
      const response = await fetch('/api/constants/versions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });

      if (!response.ok) throw await readError(response, 'Failed to save constants version');
      return response.json() as Promise<VersionedCalculationConstants>;
    },
    onSuccess: async (saved) => {
      setEditingValidFrom(saved.validFrom);
      setMessage(t('settings.updated'));
      await queryClient.invalidateQueries({ queryKey: ['constants-versions'] });
    },
    onError: (saveError) => {
      setMessage(saveError instanceof Error ? saveError.message : 'Failed to save constants version');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (validFrom: string) => {
      const response = await fetch(`/api/constants/versions/${encodeURIComponent(validFrom)}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw await readError(response, 'Failed to remove constants version');
    },
    onSuccess: async () => {
      setMessage('');
      await queryClient.invalidateQueries({ queryKey: ['constants-versions'] });
    },
    onError: (deleteError) => {
      setMessage(deleteError instanceof Error ? deleteError.message : 'Failed to remove constants version');
    },
  });

  function startNewVersion() {
    setEditingValidFrom(null);
    reset({ ...activeVersion, validFrom: selectedYearMonth });
  }

  function useDefaults() {
    setEditingValidFrom(null);
    reset({
      validFrom: selectedYearMonth,
      ...defaultCalculationConstants,
    });
  }

  async function onSubmit(values: VersionedCalculationConstants) {
    await saveMutation.mutateAsync(values);
  }

  return (
    <div style={{ display: 'grid', gap: 12, maxWidth: 980 }}>
      <div className="card" style={{ padding: 12, display: 'grid', gap: 8 }}>
        <h2 style={{ margin: 0 }}>{t('settings.title')}</h2>
        <p className="muted" style={{ margin: 0 }}>
          {t('settings.subtitle')}
        </p>

        <div className="control-row">
          <label className="muted">{t('settings.effectiveFor')}</label>
          <input
            className="input"
            type="month"
            value={selectedYearMonth}
            onChange={(event) => setSelectedYearMonth(event.target.value)}
          />
          <span className="badge">
            {t('settings.activeVersion')}: {activeVersion.validFrom}
          </span>
        </div>
      </div>

      <div className="card" style={{ padding: 12, display: 'grid', gap: 10 }}>
        <h3 style={{ margin: 0 }}>{editingValidFrom ? t('settings.editVersion') : t('settings.newVersion')}</h3>

        <form onSubmit={handleSubmit(onSubmit)} style={{ display: 'grid', gap: 10 }}>
          <div className="control-row">
            <label>{t('settings.validFrom')}</label>
            <input className="input" type="month" {...register('validFrom')} />
          </div>

          <div className="control-row">
            <label>{t('settings.pricePerFatPct')}</label>
            <input className="input" type="number" step="0.01" {...register('pricePerFatPct', { valueAsNumber: true })} />
          </div>

          <div className="control-row">
            <label>{t('settings.taxPercentage')}</label>
            <input className="input" type="number" step="0.01" {...register('taxPercentage', { valueAsNumber: true })} />
          </div>

          <div className="control-row">
            <label>{t('settings.stimLowTh')}</label>
            <input className="input" type="number" step="1" {...register('stimulationLowThreshold', { valueAsNumber: true })} />
          </div>

          <div className="control-row">
            <label>{t('settings.stimHighTh')}</label>
            <input className="input" type="number" step="1" {...register('stimulationHighThreshold', { valueAsNumber: true })} />
          </div>

          <div className="control-row">
            <label>{t('settings.stimLowAmt')}</label>
            <input className="input" type="number" step="0.01" {...register('stimulationLowAmount', { valueAsNumber: true })} />
          </div>

          <div className="control-row">
            <label>{t('settings.stimHighAmt')}</label>
            <input className="input" type="number" step="0.01" {...register('stimulationHighAmount', { valueAsNumber: true })} />
          </div>

          <div className="control-row">
            <label>{t('settings.premiumPerL')}</label>
            <input className="input" type="number" step="0.01" {...register('premiumPerLiter', { valueAsNumber: true })} />
          </div>

          {Object.keys(errors).length ? <div style={{ color: 'var(--danger)' }}>{t('settings.invalidFields')}</div> : null}
          {message ? <div style={{ color: message.includes('Failed') ? 'var(--danger)' : 'var(--accent-700)' }}>{message}</div> : null}

          <div className="control-row">
            <button className="btn primary" type="submit" disabled={!isDirty || isSubmitting || saveMutation.isPending}>
              {isSubmitting || saveMutation.isPending ? t('common.saving') : t('settings.saveVersion')}
            </button>

            <button className="btn" type="button" onClick={startNewVersion}>
              {t('settings.newVersion')}
            </button>

            <button className="btn" type="button" onClick={useDefaults}>
              {t('settings.resetDefaults')}
            </button>
          </div>
        </form>
      </div>

      <div className="card" style={{ padding: 12, display: 'grid', gap: 10 }}>
        <h3 style={{ margin: 0 }}>{t('settings.versions')}</h3>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('settings.validFrom')}</th>
                <th>{t('settings.pricePerFatPct')}</th>
                <th>{t('settings.taxPercentage')}</th>
                <th>{t('settings.premiumPerL')}</th>
                <th>{t('suppliers.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={5}>{t('common.loading')}</td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={5} style={{ color: 'var(--danger)' }}>
                    {(error as Error).message}
                  </td>
                </tr>
              ) : (
                orderedVersions.map((item) => (
                  <tr
                    key={item.validFrom}
                    style={item.validFrom === activeVersion.validFrom ? { background: '#fffbeb' } : undefined}
                  >
                    <td>{item.validFrom}</td>
                    <td>{item.pricePerFatPct.toFixed(2)}</td>
                    <td>{item.taxPercentage.toFixed(2)}</td>
                    <td>{item.premiumPerLiter.toFixed(2)}</td>
                    <td>
                      <div className="control-row">
                        <button className="btn" onClick={() => setEditingValidFrom(item.validFrom)}>
                          {t('common.edit')}
                        </button>
                        <button
                          className="btn danger"
                          onClick={() => {
                            if (orderedVersions.length <= 1) return;
                            deleteMutation.mutate(item.validFrom);
                            if (editingValidFrom === item.validFrom) {
                              setEditingValidFrom(null);
                            }
                          }}
                          disabled={orderedVersions.length <= 1 || deleteMutation.isPending}
                        >
                          {t('settings.removeVersion')}
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
    </div>
  );
}
