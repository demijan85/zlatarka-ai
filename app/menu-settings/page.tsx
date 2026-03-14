'use client';

import { useTranslation } from '@/lib/i18n/use-translation';
import { useNavigationVisibilityStore } from '@/lib/navigation/store';

const menuSections = [
  {
    id: 'purchase',
    labelKey: 'nav.sectionPurchase',
    items: [
      { id: 'dashboard', labelKey: 'nav.dashboard' },
      { id: 'daily-entry', labelKey: 'nav.daily' },
      { id: 'monthly-view', labelKey: 'nav.monthly' },
      { id: 'quarterly-view', labelKey: 'nav.quarterly' },
      { id: 'supplier-history', labelKey: 'nav.producerHistory' },
    ],
  },
  {
    id: 'purchase-admin',
    labelKey: 'nav.sectionPurchaseAdmin',
    items: [
      { id: 'suppliers', labelKey: 'nav.suppliers' },
      { id: 'constants', labelKey: 'nav.constants' },
      { id: 'corrections', labelKey: 'nav.corrections' },
      { id: 'audit-logs', labelKey: 'nav.auditLogs' },
    ],
  },
  {
    id: 'production',
    labelKey: 'nav.sectionProduction',
    items: [
      { id: 'production-dashboard', labelKey: 'nav.productionDashboard' },
      { id: 'production-entry', labelKey: 'nav.productionEntry' },
      { id: 'production-products', labelKey: 'nav.productionProducts' },
      { id: 'production-reports', labelKey: 'nav.productionReports' },
      { id: 'production-traceability', labelKey: 'nav.traceability' },
    ],
  },
  {
    id: 'sales',
    labelKey: 'nav.sectionSales',
    items: [
      { id: 'sales-dashboard', labelKey: 'nav.salesInventory' },
      { id: 'sales-deliveries', labelKey: 'nav.salesDeliveries' },
      { id: 'sales-customers', labelKey: 'nav.salesCustomers' },
    ],
  },
];

export default function MenuSettingsPage() {
  const { t } = useTranslation();
  const hiddenSectionIds = useNavigationVisibilityStore((state) => state.hiddenSectionIds);
  const hiddenItemIds = useNavigationVisibilityStore((state) => state.hiddenItemIds);
  const setSectionHidden = useNavigationVisibilityStore((state) => state.setSectionHidden);
  const setItemHidden = useNavigationVisibilityStore((state) => state.setItemHidden);
  const reset = useNavigationVisibilityStore((state) => state.reset);

  return (
    <div className="module-page" style={{ maxWidth: 820 }}>
      <div className="card module-hero-main">
        <div style={{ display: 'grid', gap: 6 }}>
          <h2 style={{ margin: 0 }}>{t('menuSettings.title')}</h2>
          <div className="muted">{t('menuSettings.subtitle')}</div>
        </div>
      </div>

      <div className="card module-form-card">
        <div className="production-header-row">
          <strong>{t('menuSettings.visibleSections')}</strong>
          <button className="btn" type="button" onClick={reset}>
            {t('menuSettings.reset')}
          </button>
        </div>

        <div className="production-card-grid">
          {menuSections.map((section) => {
            const sectionVisible = !hiddenSectionIds.includes(section.id);

            return (
              <div key={section.id} className="card" style={{ padding: 14, display: 'grid', gap: 12 }}>
                <div className="production-header-row">
                  <div style={{ display: 'grid', gap: 4 }}>
                    <strong>{t(section.labelKey)}</strong>
                    <div className="muted">{sectionVisible ? t('menuSettings.visible') : t('menuSettings.hidden')}</div>
                  </div>
                  <input type="checkbox" checked={sectionVisible} onChange={(event) => setSectionHidden(section.id, !event.target.checked)} />
                </div>

                <div style={{ display: 'grid', gap: 10 }}>
                  {section.items.map((item) => {
                    const visible = !hiddenItemIds.includes(item.id);

                    return (
                      <label key={item.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                        <span>{t(item.labelKey)}</span>
                        <input
                          type="checkbox"
                          checked={visible}
                          onChange={(event) => setItemHidden(item.id, !event.target.checked)}
                        />
                      </label>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
