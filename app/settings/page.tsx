'use client';

import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  getEffectiveConstantsForPeriod,
  sortVersions,
  versionedCalculationConstantsSchema,
  type VersionedCalculationConstants,
} from '@/lib/constants/calculation';
import { useConstantsStore } from '@/lib/constants/store';
import { useTranslation } from '@/lib/i18n/use-translation';

export default function SettingsPage() {
  const { t } = useTranslation();
  const versions = useConstantsStore((state) => state.versions);
  const selectedYearMonth = useConstantsStore((state) => state.selectedYearMonth);
  const setSelectedYearMonth = useConstantsStore((state) => state.setSelectedYearMonth);
  const upsertVersion = useConstantsStore((state) => state.upsertVersion);
  const removeVersion = useConstantsStore((state) => state.removeVersion);
  const resetTimeline = useConstantsStore((state) => state.reset);

  const [editingValidFrom, setEditingValidFrom] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  const orderedVersions = useMemo(() => sortVersions(versions), [versions]);
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

  function startNewVersion() {
    setEditingValidFrom(null);
    reset({ ...activeVersion, validFrom: selectedYearMonth });
  }

  async function onSubmit(values: VersionedCalculationConstants) {
    upsertVersion(values);
    setEditingValidFrom(values.validFrom);
    setMessage(t('settings.updated'));
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
            <input
              className="input"
              type="number"
              step="1"
              {...register('stimulationLowThreshold', { valueAsNumber: true })}
            />
          </div>

          <div className="control-row">
            <label>{t('settings.stimHighTh')}</label>
            <input
              className="input"
              type="number"
              step="1"
              {...register('stimulationHighThreshold', { valueAsNumber: true })}
            />
          </div>

          <div className="control-row">
            <label>{t('settings.stimLowAmt')}</label>
            <input
              className="input"
              type="number"
              step="0.01"
              {...register('stimulationLowAmount', { valueAsNumber: true })}
            />
          </div>

          <div className="control-row">
            <label>{t('settings.stimHighAmt')}</label>
            <input
              className="input"
              type="number"
              step="0.01"
              {...register('stimulationHighAmount', { valueAsNumber: true })}
            />
          </div>

          <div className="control-row">
            <label>{t('settings.premiumPerL')}</label>
            <input className="input" type="number" step="0.01" {...register('premiumPerLiter', { valueAsNumber: true })} />
          </div>

          {Object.keys(errors).length ? (
            <div style={{ color: 'var(--danger)' }}>{t('settings.invalidFields')}</div>
          ) : null}

          {message ? <div style={{ color: 'var(--accent-700)' }}>{message}</div> : null}

          <div className="control-row">
            <button className="btn primary" type="submit" disabled={!isDirty || isSubmitting}>
              {isSubmitting ? t('common.saving') : t('settings.saveVersion')}
            </button>

            <button
              className="btn"
              type="button"
              onClick={startNewVersion}
            >
              {t('settings.newVersion')}
            </button>

            <button
              className="btn"
              type="button"
              onClick={() => {
                resetTimeline();
                setEditingValidFrom(null);
                setMessage('');
              }}
            >
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
              {orderedVersions.map((item) => (
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
                          removeVersion(item.validFrom);
                          if (editingValidFrom === item.validFrom) {
                            setEditingValidFrom(null);
                          }
                        }}
                        disabled={orderedVersions.length <= 1}
                      >
                        {t('settings.removeVersion')}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
