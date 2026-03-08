'use client';

import { useState } from 'react';
import { useTranslation } from '@/lib/i18n/use-translation';

type ReportView = 'weekly' | 'monthly' | 'yearly';

export default function ProductionReportsPage() {
  const { t } = useTranslation();
  const [view, setView] = useState<ReportView>('weekly');

  const content: Record<ReportView, string[]> = {
    weekly: [t('productionReports.focusWeekly1'), t('productionReports.focusWeekly2')],
    monthly: [t('productionReports.focusMonthly1'), t('productionReports.focusMonthly2')],
    yearly: [t('productionReports.focusYearly1'), t('productionReports.focusYearly2')],
  };

  const buttons: Array<{ key: ReportView; label: string }> = [
    { key: 'weekly', label: t('productionReports.weekly') },
    { key: 'monthly', label: t('productionReports.monthly') },
    { key: 'yearly', label: t('productionReports.yearly') },
  ];

  return (
    <div className="module-page">
      <div className="card" style={{ padding: 14, display: 'grid', gap: 10 }}>
        <h2 style={{ margin: 0 }}>{t('productionReports.title')}</h2>
        <div className="muted">{t('productionReports.subtitle')}</div>

        <div className="control-row">
          {buttons.map((button) => (
            <button
              key={button.key}
              type="button"
              className={`btn${view === button.key ? ' primary' : ''}`}
              onClick={() => setView(button.key)}
            >
              {button.label}
            </button>
          ))}
        </div>
      </div>

      <div className="module-hero">
        <div className="card module-form-card">
          <div className="muted" style={{ fontSize: 12 }}>
            {t('productionReports.focus')}
          </div>
          <div className="module-step-list">
            {content[view].map((item) => (
              <div key={item} className="module-step-item">
                {item}
              </div>
            ))}
          </div>
        </div>

        <div className="card module-side-card">
          <div className="muted" style={{ fontSize: 12 }}>
            {buttons.find((item) => item.key === view)?.label}
          </div>
          <div className="module-summary-stack">
            <div>
              <span>{t('production.kpiMilkReceived')}</span>
              <strong>{view === 'weekly' ? '31,500 L' : view === 'monthly' ? '128,400 L' : '1,482,000 L'}</strong>
            </div>
            <div>
              <span>{t('production.kpiCheeseMade')}</span>
              <strong>{view === 'weekly' ? '3,960 kg' : view === 'monthly' ? '16,220 kg' : '188,900 kg'}</strong>
            </div>
            <div>
              <span>{t('production.kpiAvgYield')}</span>
              <strong>{view === 'weekly' ? '7.95 L/kg' : view === 'monthly' ? '7.91 L/kg' : '7.85 L/kg'}</strong>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
