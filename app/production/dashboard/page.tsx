'use client';

import Link from 'next/link';
import { useTranslation } from '@/lib/i18n/use-translation';

export default function ProductionDashboardPage() {
  const { t } = useTranslation();

  const kpis = [
    { label: t('production.kpiMilkReceived'), value: '4,850 L' },
    { label: t('production.kpiCheeseMade'), value: '612 kg' },
    { label: t('production.kpiAvgYield'), value: '7.92 L/kg' },
    { label: t('production.kpiFatUnit'), value: '3.74' },
    { label: t('production.kpiPacked'), value: '488 kg' },
    { label: t('production.kpiOpenStock'), value: '124 kg' },
  ];

  const quickLinks = [
    {
      href: '/production/daily-entry',
      title: t('production.entryCard'),
      text: t('production.entryCardText'),
    },
    {
      href: '/production/reports',
      title: t('production.reportsCard'),
      text: t('production.reportsCardText'),
    },
    {
      href: '/production/traceability',
      title: t('production.traceCard'),
      text: t('production.traceCardText'),
    },
  ];

  const steps = [
    t('production.quickStart1'),
    t('production.quickStart2'),
    t('production.quickStart3'),
    t('production.quickStart4'),
  ];

  return (
    <div className="module-page">
      <div className="module-hero">
        <div className="card module-hero-main">
          <h2 style={{ margin: 0 }}>{t('production.dashboardTitle')}</h2>
          <div className="muted">{t('production.dashboardSubtitle')}</div>

          <div className="module-step-list">
            {steps.map((step) => (
              <div key={step} className="module-step-item">
                {step}
              </div>
            ))}
          </div>
        </div>

        <div className="card module-hero-side">
          <div className="muted" style={{ fontSize: 12 }}>
            {t('production.nextViews')}
          </div>
          <div className="module-link-grid">
            {quickLinks.map((item) => (
              <Link key={item.href} href={item.href} className="module-link-card">
                <strong>{item.title}</strong>
                <span className="muted">{item.text}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>

      <div className="module-kpi-grid">
        {kpis.map((item) => (
          <div key={item.label} className="card" style={{ padding: 14 }}>
            <div className="muted">{item.label}</div>
            <div style={{ fontSize: 26, fontWeight: 700 }}>{item.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
