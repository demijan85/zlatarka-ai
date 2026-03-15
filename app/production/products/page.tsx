'use client';

import { useProductionStore } from '@/lib/production/store';
import { useTranslation } from '@/lib/i18n/use-translation';

export default function ProductionProductsPage() {
  const { t } = useTranslation();
  const products = useProductionStore((state) => state.products);
  const packaging = useProductionStore((state) => state.packaging);
  const addProduct = useProductionStore((state) => state.addProduct);
  const updateProduct = useProductionStore((state) => state.updateProduct);
  const addPackaging = useProductionStore((state) => state.addPackaging);
  const updatePackaging = useProductionStore((state) => state.updatePackaging);

  return (
    <div className="module-page">
      <div className="card module-hero-main">
        <div className="production-header-row">
          <div style={{ display: 'grid', gap: 6 }}>
            <h2 style={{ margin: 0 }}>{t('productionProducts.title')}</h2>
            <div className="muted">{t('productionProducts.subtitle')}</div>
          </div>
          <button className="btn primary" type="button" onClick={() => addProduct()}>
            {t('productionProducts.addProduct')}
          </button>
        </div>
      </div>

      <div className="production-card-grid">
        {products.map((product) => {
          const productPackaging = packaging.filter((item) => item.productId === product.id);

          return (
            <div key={product.id} className="card module-form-card">
              <div className="production-header-row">
                <strong>{product.name || t('productionProducts.newProduct')}</strong>
                <span className="badge">{product.category}</span>
              </div>

              <div className="module-form-grid">
                <label className="module-field">
                  <span>{t('productionProducts.productName')}</span>
                  <input className="input" value={product.name} onChange={(event) => updateProduct(product.id, { name: event.target.value })} />
                </label>
                <label className="module-field">
                  <span>{t('productionProducts.productCode')}</span>
                  <input className="input" value={product.code} onChange={(event) => updateProduct(product.id, { code: event.target.value })} />
                </label>
              </div>

              <label className="module-field">
                <span>{t('productionProducts.description')}</span>
                <textarea
                  className="input"
                  style={{ minHeight: 72 }}
                  value={product.description}
                  onChange={(event) => updateProduct(product.id, { description: event.target.value })}
                />
              </label>

              <div className="production-inline-section">
                <div className="production-header-row">
                  <strong>{t('productionProducts.packagingTitle')}</strong>
                  <button className="btn" type="button" onClick={() => addPackaging(product.id)}>
                    {t('productionProducts.addPackage')}
                  </button>
                </div>

                <div className="production-subgrid">
                  {productPackaging.map((item) => (
                    <div key={item.id} className="production-inline-card">
                      <label className="module-field">
                        <span>{t('productionProducts.packageLabel')}</span>
                        <input
                          className="input"
                          value={item.label}
                          onChange={(event) => updatePackaging(item.id, { label: event.target.value })}
                        />
                      </label>
                      <label className="module-field">
                        <span>{t('productionProducts.packageCode')}</span>
                        <input
                          className="input"
                          value={item.code}
                          onChange={(event) => updatePackaging(item.id, { code: event.target.value })}
                        />
                      </label>
                      <label className="module-field">
                        <span>{t('productionProducts.packageWeight')}</span>
                        <input
                          className="input"
                          type="number"
                          step="0.1"
                          value={item.unitWeightKg}
                          onChange={(event) =>
                            updatePackaging(item.id, {
                              unitWeightKg: Number(event.target.value) || 0,
                            })
                          }
                        />
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
