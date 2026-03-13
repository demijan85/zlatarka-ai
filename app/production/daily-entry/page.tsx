'use client';

import { useMemo, useState } from 'react';
import { useTranslation } from '@/lib/i18n/use-translation';

function parseNumber(value: string): number {
  const normalized = Number(value.replace(',', '.'));
  return Number.isFinite(normalized) ? normalized : 0;
}

export default function ProductionDailyEntryPage() {
  const { t } = useTranslation();
  const [milkReceived, setMilkReceived] = useState('4850');
  const [cheeseProduced, setCheeseProduced] = useState('612');
  const [fatUnit, setFatUnit] = useState('3.74');
  const [pack5kg, setPack5kg] = useState('40');
  const [pack1kg, setPack1kg] = useState('160');
  const [pack300g, setPack300g] = useState('290');

  const milkValue = parseNumber(milkReceived);
  const cheeseValue = parseNumber(cheeseProduced);
  const pack5Value = parseNumber(pack5kg);
  const pack1Value = parseNumber(pack1kg);
  const pack300Value = parseNumber(pack300g);

  const avgMilkForKg = useMemo(() => (cheeseValue > 0 ? milkValue / cheeseValue : 0), [cheeseValue, milkValue]);
  const packedKg = useMemo(() => pack5Value * 5 + pack1Value + pack300Value * 0.3, [pack1Value, pack300Value, pack5Value]);
  const remainingKg = useMemo(() => Math.max(cheeseValue - packedKg, 0), [cheeseValue, packedKg]);

  function formatNumber(value: number, digits = 0): string {
    return value.toLocaleString('sr-RS', {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    });
  }

  return (
    <div className="module-page">
      <div className="card" style={{ padding: 14, display: 'grid', gap: 10 }}>
        <h2 style={{ margin: 0 }}>{t('productionEntry.title')}</h2>
        <div className="muted">{t('productionEntry.subtitle')}</div>
        <span className="badge">{t('productionEntry.prototype')}</span>
      </div>

      <div className="module-hero">
        <div className="card module-form-card">
          <div className="module-form-grid">
            <label className="module-field">
              <span>{t('productionEntry.milkReceived')}</span>
              <input className="input" value={milkReceived} onChange={(event) => setMilkReceived(event.target.value)} />
            </label>

            <label className="module-field">
              <span>{t('productionEntry.cheeseProduced')}</span>
              <input className="input" value={cheeseProduced} onChange={(event) => setCheeseProduced(event.target.value)} />
            </label>

            <label className="module-field">
              <span>{t('productionEntry.avgMilkForKg')}</span>
              <input className="input" value={formatNumber(avgMilkForKg, 2)} readOnly />
            </label>

            <label className="module-field">
              <span>
                {t('productionEntry.avgFatUnit')} <small className="muted">({t('productionEntry.optional')})</small>
              </span>
              <input className="input" value={fatUnit} onChange={(event) => setFatUnit(event.target.value)} />
            </label>
          </div>
        </div>

        <div className="card module-side-card">
          <div className="muted" style={{ fontSize: 12 }}>
            {t('productionEntry.traceability')}
          </div>
          <div className="module-summary-stack">
            <div>
              <span>{t('productionEntry.milkReceived')}</span>
              <strong>{`${formatNumber(milkValue, 0)} L`}</strong>
            </div>
            <div>
              <span>{t('productionEntry.cheeseProduced')}</span>
              <strong>{`${formatNumber(cheeseValue, 0)} kg`}</strong>
            </div>
            <div>
              <span>{t('productionEntry.packedKg')}</span>
              <strong>{`${formatNumber(packedKg, 1)} kg`}</strong>
            </div>
            <div>
              <span>{t('productionEntry.remainingKg')}</span>
              <strong>{`${formatNumber(remainingKg, 1)} kg`}</strong>
            </div>
          </div>
          <div className="muted">{t('productionEntry.traceabilityText')}</div>
        </div>
      </div>

      <div className="card" style={{ padding: 14, display: 'grid', gap: 12 }}>
        <h3 style={{ margin: 0 }}>{t('productionEntry.packaging')}</h3>
        <div className="module-form-grid module-pack-grid">
          <label className="module-field">
            <span>{t('productionEntry.package5kg')}</span>
            <input className="input" value={pack5kg} onChange={(event) => setPack5kg(event.target.value)} />
            <small className="muted">{t('productionEntry.packageCount')}</small>
          </label>

          <label className="module-field">
            <span>{t('productionEntry.package1kg')}</span>
            <input className="input" value={pack1kg} onChange={(event) => setPack1kg(event.target.value)} />
            <small className="muted">{t('productionEntry.packageCount')}</small>
          </label>

          <label className="module-field">
            <span>{t('productionEntry.package300g')}</span>
            <input className="input" value={pack300g} onChange={(event) => setPack300g(event.target.value)} />
            <small className="muted">{t('productionEntry.packageCount')}</small>
          </label>
        </div>

        <div className="module-kpi-grid">
          <div className="card" style={{ padding: 14 }}>
            <div className="muted">{t('productionEntry.packedKg')}</div>
            <div style={{ fontSize: 24, fontWeight: 700 }}>{`${formatNumber(packedKg, 1)} kg`}</div>
          </div>
          <div className="card" style={{ padding: 14 }}>
            <div className="muted">{t('productionEntry.remainingKg')}</div>
            <div style={{ fontSize: 24, fontWeight: 700 }}>{`${formatNumber(remainingKg, 1)} kg`}</div>
          </div>
          <div className="card" style={{ padding: 14 }}>
            <div className="muted">{t('productionEntry.avgFatUnit')}</div>
            <div style={{ fontSize: 24, fontWeight: 700 }}>{fatUnit || '-'}</div>
          </div>
        </div>

        <div className="muted">{t('productionEntry.saveConcept')}</div>
      </div>
    </div>
  );
}
