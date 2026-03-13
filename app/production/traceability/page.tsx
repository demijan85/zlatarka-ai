'use client';

import { useTranslation } from '@/lib/i18n/use-translation';

export default function ProductionTraceabilityPage() {
  const { t } = useTranslation();

  const steps = [
    { title: t('productionTrace.stepMilk'), text: t('productionTrace.stepMilkText') },
    { title: t('productionTrace.stepCheese'), text: t('productionTrace.stepCheeseText') },
    { title: t('productionTrace.stepPackaging'), text: t('productionTrace.stepPackagingText') },
    { title: t('productionTrace.stepReports'), text: t('productionTrace.stepReportsText') },
  ];

  const storage = [
    t('productionTrace.mustStore1'),
    t('productionTrace.mustStore2'),
    t('productionTrace.mustStore3'),
    t('productionTrace.mustStore4'),
  ];

  return (
    <div className="module-page">
      <div className="card" style={{ padding: 14, display: 'grid', gap: 10 }}>
        <h2 style={{ margin: 0 }}>{t('productionTrace.title')}</h2>
        <div className="muted">{t('productionTrace.subtitle')}</div>
      </div>

      <div className="trace-grid">
        {steps.map((step) => (
          <div key={step.title} className="card" style={{ padding: 16, display: 'grid', gap: 10 }}>
            <strong>{step.title}</strong>
            <div className="muted">{step.text}</div>
          </div>
        ))}
      </div>

      <div className="card" style={{ padding: 16, display: 'grid', gap: 12 }}>
        <strong>{t('productionTrace.mustStore')}</strong>
        <div className="module-step-list">
          {storage.map((item) => (
            <div key={item} className="module-step-item">
              {item}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
