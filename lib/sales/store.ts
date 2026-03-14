'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Customer, SalesDispatch, SalesDispatchItem } from '@/types/sales';

type SalesState = {
  customers: Customer[];
  dispatches: Record<string, SalesDispatch>;
  addCustomer: () => void;
  updateCustomer: (id: string, patch: Partial<Customer>) => void;
  upsertDispatch: (dispatch: SalesDispatch) => void;
  removeDispatch: (id: string) => void;
};

function createCustomerId() {
  return `customer-${Date.now()}`;
}

function createDispatchId() {
  return `dispatch-${Date.now()}`;
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

function normalizeCustomer(value: unknown, index: number): Customer {
  const item = isRecord(value) ? value : {};

  return {
    id: toString(item.id, `customer-${index}`),
    code: toString(item.code, `CUST-${index + 1}`),
    name: toString(item.name),
    city: toString(item.city),
    phone: toString(item.phone),
    email: toString(item.email),
    address: toString(item.address),
    note: toString(item.note),
    active: item.active !== false,
  };
}

function normalizeDispatchItem(value: unknown): SalesDispatchItem | null {
  if (!isRecord(value)) return null;

  return {
    packagingId: toString(value.packagingId),
    quantity: toNumber(value.quantity),
  };
}

function normalizeDispatch(value: unknown, fallbackId: string): SalesDispatch {
  const item = isRecord(value) ? value : {};
  const items = Array.isArray(item.items) ? item.items.map(normalizeDispatchItem).filter((row): row is SalesDispatchItem => Boolean(row)) : [];

  return {
    id: toString(item.id, fallbackId),
    date: toString(item.date),
    customerId: toString(item.customerId),
    note: toString(item.note),
    items,
    updatedAt: toString(item.updatedAt, new Date().toISOString()),
  };
}

function normalizeCustomers(value: unknown) {
  return Array.isArray(value) ? value.map(normalizeCustomer) : [];
}

function normalizeDispatches(value: unknown) {
  if (!isRecord(value)) return {};

  return Object.fromEntries(
    Object.entries(value).map(([id, dispatch]) => {
      const normalized = normalizeDispatch(dispatch, id);
      return [normalized.id, normalized];
    })
  ) as Record<string, SalesDispatch>;
}

export const useSalesStore = create<SalesState>()(
  persist(
    (set) => ({
      customers: [],
      dispatches: {},
      addCustomer: () =>
        set((state) => {
          const id = createCustomerId();

          return {
            customers: [
              ...state.customers,
              {
                id,
                code: `CUST-${state.customers.length + 1}`,
                name: '',
                city: '',
                phone: '',
                email: '',
                address: '',
                note: '',
                active: true,
              },
            ],
          };
        }),
      updateCustomer: (id, patch) =>
        set((state) => ({
          customers: state.customers.map((customer) => (customer.id === id ? { ...customer, ...patch } : customer)),
        })),
      upsertDispatch: (dispatch) =>
        set((state) => {
          const id = dispatch.id || createDispatchId();
          return {
            dispatches: {
              ...state.dispatches,
              [id]: {
                ...normalizeDispatch({ ...dispatch, id }, id),
                updatedAt: new Date().toISOString(),
              },
            },
          };
        }),
      removeDispatch: (id) =>
        set((state) => {
          const next = { ...state.dispatches };
          delete next[id];
          return { dispatches: next };
        }),
    }),
    {
      name: 'zlatarka-v1-sales',
      version: 1,
      migrate: (persistedState) => {
        const persisted = isRecord(persistedState) ? persistedState : {};
        return {
          customers: normalizeCustomers(persisted.customers),
          dispatches: normalizeDispatches(persisted.dispatches),
        };
      },
      partialize: (state) => ({
        customers: state.customers,
        dispatches: state.dispatches,
      }),
      merge: (persistedState, currentState) => {
        const persisted = isRecord(persistedState) ? persistedState : {};
        return {
          ...currentState,
          customers: normalizeCustomers(persisted.customers),
          dispatches: normalizeDispatches(persisted.dispatches),
        };
      },
    }
  )
);
