'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const defaultHiddenItemIds = ['corrections', 'audit-logs', 'production-products'];
const defaultHiddenSectionIds: string[] = [];

type NavigationState = {
  hiddenSectionIds: string[];
  hiddenItemIds: string[];
  setSectionHidden: (id: string, hidden: boolean) => void;
  setItemHidden: (id: string, hidden: boolean) => void;
  reset: () => void;
};

export const useNavigationVisibilityStore = create<NavigationState>()(
  persist(
    (set) => ({
      hiddenSectionIds: defaultHiddenSectionIds,
      hiddenItemIds: defaultHiddenItemIds,
      setSectionHidden: (id, hidden) =>
        set((state) => ({
          hiddenSectionIds: hidden
            ? [...new Set([...state.hiddenSectionIds, id])]
            : state.hiddenSectionIds.filter((item) => item !== id),
        })),
      setItemHidden: (id, hidden) =>
        set((state) => ({
          hiddenItemIds: hidden ? [...new Set([...state.hiddenItemIds, id])] : state.hiddenItemIds.filter((item) => item !== id),
        })),
      reset: () => set({ hiddenSectionIds: defaultHiddenSectionIds, hiddenItemIds: defaultHiddenItemIds }),
    }),
    {
      name: 'zlatarka-navigation-visibility',
    }
  )
);
