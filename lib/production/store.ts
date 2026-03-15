'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  PackagingDefinition,
  PackagingRecord,
  ProductionOutput,
  ProductionProduct,
  ProductionRecord,
} from '@/types/production';

type ProductionState = {
  products: ProductionProduct[];
  packaging: PackagingDefinition[];
  records: Record<string, ProductionRecord>;
  upsertRecord: (record: ProductionRecord) => void;
  addProduct: () => void;
  updateProduct: (id: string, patch: Partial<ProductionProduct>) => void;
  addPackaging: (productId: string) => void;
  updatePackaging: (id: string, patch: Partial<PackagingDefinition>) => void;
};

const defaultProducts: ProductionProduct[] = [
  {
    id: 'cheese',
    code: 'CHEESE',
    name: 'Sir',
    category: 'cheese',
    description: 'Osnovni proizvod iz dnevne prerade mleka.',
    active: true,
  },
];

const defaultPackaging: PackagingDefinition[] = [
  { id: 'cheese-5kg', productId: 'cheese', label: 'Sir 5 kg', code: 'CHE-5', unitWeightKg: 5, active: true },
  { id: 'cheese-3kg', productId: 'cheese', label: 'Sir 3 kg', code: 'CHE-3', unitWeightKg: 3, active: true },
  { id: 'cheese-300g', productId: 'cheese', label: 'Sir 300 g', code: 'CHE-03', unitWeightKg: 0.3, active: true },
];

function createProductId() {
  return `product-${Date.now()}`;
}

function createPackagingId(productId: string) {
  return `${productId}-pack-${Date.now()}`;
}

function toNumber(value: unknown, fallback = 0) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function toString(value: unknown, fallback = '') {
  return typeof value === 'string' ? value : fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function normalizeProduct(value: unknown, index: number): ProductionProduct {
  const item = isRecord(value) ? value : {};
  return {
    id: toString(item.id, `product-${index}`),
    code: toString(item.code, `PRD-${index + 1}`),
    name: toString(item.name),
    category: item.category === 'cheese' ? 'cheese' : 'dairy',
    description: toString(item.description),
    active: item.active !== false,
  };
}

function normalizePackaging(value: unknown, index: number): PackagingDefinition {
  const item = isRecord(value) ? value : {};
  return {
    id: toString(item.id, `packaging-${index}`),
    productId: toString(item.productId, 'cheese'),
    label: toString(item.label),
    code: toString(item.code),
    unitWeightKg: toNumber(item.unitWeightKg),
    active: item.active !== false,
  };
}

function normalizeOutput(value: unknown): ProductionOutput | null {
  if (!isRecord(value)) return null;

  return {
    productId: toString(value.productId),
    milkUsedLiters: toNumber(value.milkUsedLiters),
    producedKg: toNumber(value.producedKg),
    wasteKg: toNumber(value.wasteKg),
    note: toString(value.note),
  };
}

function normalizePackagingRecord(value: unknown): PackagingRecord | null {
  if (!isRecord(value)) return null;

  return {
    packagingId: toString(value.packagingId),
    packedCount: toNumber(value.packedCount),
  };
}

function normalizeProductionRecord(value: unknown, fallbackDate: string): ProductionRecord {
  const item = isRecord(value) ? value : {};
  const outputs = Array.isArray(item.outputs) ? item.outputs.map(normalizeOutput).filter((row): row is ProductionOutput => Boolean(row)) : [];
  const packaging = Array.isArray(item.packaging)
    ? item.packaging.map(normalizePackagingRecord).filter((row): row is PackagingRecord => Boolean(row))
    : [];

  return {
    date: toString(item.date, fallbackDate),
    carryoverMilkLiters: toNumber(item.carryoverMilkLiters),
    milkWasteLiters: toNumber(item.milkWasteLiters),
    averageFatUnit: typeof item.averageFatUnit === 'number' && Number.isFinite(item.averageFatUnit) ? item.averageFatUnit : null,
    note: toString(item.note),
    outputs,
    packaging,
    updatedAt: toString(item.updatedAt, new Date().toISOString()),
  };
}

function mergeProducts(persisted: unknown) {
  const persistedProducts = Array.isArray(persisted) ? persisted.map(normalizeProduct) : [];
  const byId = new Map(defaultProducts.map((item) => [item.id, item]));

  for (const product of persistedProducts) {
    byId.set(product.id, { ...byId.get(product.id), ...product });
  }

  return [...byId.values()];
}

function mergePackaging(persisted: unknown) {
  const persistedPackaging = Array.isArray(persisted) ? persisted.map(normalizePackaging) : [];
  const byId = new Map(defaultPackaging.map((item) => [item.id, item]));

  for (const packaging of persistedPackaging) {
    byId.set(packaging.id, { ...byId.get(packaging.id), ...packaging });
  }

  return [...byId.values()];
}

function normalizeRecords(value: unknown) {
  if (!isRecord(value)) return {};

  return Object.fromEntries(
    Object.entries(value).map(([date, record]) => {
      const normalized = normalizeProductionRecord(record, date);
      return [normalized.date, normalized];
    })
  ) as Record<string, ProductionRecord>;
}

export const useProductionStore = create<ProductionState>()(
  persist(
    (set) => ({
      products: defaultProducts,
      packaging: defaultPackaging,
      records: {},
      upsertRecord: (record) =>
        set((state) => ({
          records: {
            ...state.records,
            [record.date]: {
              ...normalizeProductionRecord(record, record.date),
              updatedAt: new Date().toISOString(),
            },
          },
        })),
      addProduct: () =>
        set((state) => {
          const id = createProductId();
          return {
            products: [
              ...state.products,
              {
                id,
                code: `PRD-${state.products.length + 1}`,
                name: '',
                category: 'dairy',
                description: '',
                active: true,
              },
            ],
          };
        }),
      updateProduct: (id, patch) =>
        set((state) => ({
          products: state.products.map((product) => (product.id === id ? { ...product, ...patch } : product)),
        })),
      addPackaging: (productId) =>
        set((state) => ({
          packaging: [
            ...state.packaging,
            {
              id: createPackagingId(productId),
              productId,
              label: '',
              code: '',
              unitWeightKg: 0,
              active: true,
            },
          ],
        })),
      updatePackaging: (id, patch) =>
        set((state) => ({
          packaging: state.packaging.map((item) => (item.id === id ? { ...item, ...patch } : item)),
        })),
    }),
    {
      name: 'zlatarka-v2-production',
      version: 1,
      migrate: (persistedState) => {
        const persisted = isRecord(persistedState) ? persistedState : {};

        return {
          products: mergeProducts(persisted.products),
          packaging: mergePackaging(persisted.packaging),
          records: normalizeRecords(persisted.records),
        };
      },
      partialize: (state) => ({
        products: state.products,
        packaging: state.packaging,
        records: state.records,
      }),
      merge: (persistedState, currentState) => {
        const persisted = isRecord(persistedState) ? persistedState : {};

        return {
          ...currentState,
          products: mergeProducts(persisted.products),
          packaging: mergePackaging(persisted.packaging),
          records: normalizeRecords(persisted.records),
        };
      },
    }
  )
);
