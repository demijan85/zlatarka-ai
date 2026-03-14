'use client';

import Link from 'next/link';
import { useSalesStore } from '@/lib/sales/store';
import { useTranslation } from '@/lib/i18n/use-translation';

export default function SalesCustomersPage() {
  const { t } = useTranslation();
  const customers = useSalesStore((state) => state.customers);
  const addCustomer = useSalesStore((state) => state.addCustomer);
  const updateCustomer = useSalesStore((state) => state.updateCustomer);

  return (
    <div className="module-page">
      <div className="card module-hero-main">
        <div className="production-header-row">
          <div style={{ display: 'grid', gap: 6 }}>
            <h2 style={{ margin: 0 }}>{t('sales.customersTitle')}</h2>
            <div className="muted">{t('sales.customersSubtitle')}</div>
          </div>
          <button className="btn primary" type="button" onClick={() => addCustomer()}>
            {t('sales.addCustomer')}
          </button>
        </div>
      </div>

      <div className="production-card-grid">
        {customers.map((customer) => (
          <div key={customer.id} className="card module-form-card">
            <div className="production-header-row">
              <strong>{customer.name || customer.code}</strong>
              <Link className="btn" href={`/sales/customers/${customer.id}`}>
                {t('sales.customerView')}
              </Link>
            </div>

            <div className="module-form-grid">
              <label className="module-field">
                <span>{t('sales.customerName')}</span>
                <input className="input" value={customer.name} onChange={(event) => updateCustomer(customer.id, { name: event.target.value })} />
              </label>
              <label className="module-field">
                <span>{t('sales.customerCode')}</span>
                <input className="input" value={customer.code} onChange={(event) => updateCustomer(customer.id, { code: event.target.value })} />
              </label>
              <label className="module-field">
                <span>{t('supplierForm.city')}</span>
                <input className="input" value={customer.city} onChange={(event) => updateCustomer(customer.id, { city: event.target.value })} />
              </label>
              <label className="module-field">
                <span>{t('supplierForm.phone')}</span>
                <input className="input" value={customer.phone} onChange={(event) => updateCustomer(customer.id, { phone: event.target.value })} />
              </label>
              <label className="module-field">
                <span>{t('supplierForm.email')}</span>
                <input className="input" value={customer.email} onChange={(event) => updateCustomer(customer.id, { email: event.target.value })} />
              </label>
              <label className="module-field">
                <span>{t('sales.customerAddress')}</span>
                <input className="input" value={customer.address} onChange={(event) => updateCustomer(customer.id, { address: event.target.value })} />
              </label>
            </div>

            <label className="module-field">
              <span>{t('productionProducts.description')}</span>
              <textarea
                className="input"
                style={{ minHeight: 72 }}
                value={customer.note}
                onChange={(event) => updateCustomer(customer.id, { note: event.target.value })}
              />
            </label>
          </div>
        ))}

        {!customers.length ? (
          <div className="card module-form-card">
            <div className="muted">{t('common.noData')}</div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
