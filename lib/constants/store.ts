'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  defaultVersionedConstants,
  getEffectiveConstantsForPeriod,
  normalizeVersionedConstants,
  sortVersions,
  toCalculationConstants,
  type CalculationConstants,
  type VersionedCalculationConstants,
} from '@/lib/constants/calculation';
import { yearMonthFrom } from '@/lib/utils/year-month';

function nowYearMonth(): string {
  const now = new Date();
  return yearMonthFrom(now.getFullYear(), now.getMonth() + 1);
}

type ConstantsTimelineState = {
  versions: VersionedCalculationConstants[];
  selectedYearMonth: string;
  setSelectedYearMonth: (yearMonth: string) => void;
  upsertVersion: (version: VersionedCalculationConstants) => void;
  removeVersion: (validFrom: string) => void;
  reset: () => void;
  getEffectiveVersion: (yearMonth: string) => VersionedCalculationConstants;
  getEffectiveConstants: (yearMonth: string) => CalculationConstants;
};

const initialVersions = [defaultVersionedConstants];

export const useConstantsStore = create<ConstantsTimelineState>()(
  persist(
    (set, get) => ({
      versions: initialVersions,
      selectedYearMonth: nowYearMonth(),
      setSelectedYearMonth: (selectedYearMonth) => set({ selectedYearMonth }),
      upsertVersion: (version) => {
        const nextVersion = normalizeVersionedConstants(version);
        const existing = get().versions;
        const withoutSamePeriod = existing.filter((item) => item.validFrom !== nextVersion.validFrom);
        const merged = sortVersions([...withoutSamePeriod, nextVersion]);
        set({ versions: merged });
      },
      removeVersion: (validFrom) => {
        const existing = get().versions;
        if (existing.length <= 1) return;
        const next = existing.filter((item) => item.validFrom !== validFrom);
        set({ versions: next.length ? sortVersions(next) : [defaultVersionedConstants] });
      },
      reset: () =>
        set({
          versions: [defaultVersionedConstants],
          selectedYearMonth: nowYearMonth(),
        }),
      getEffectiveVersion: (yearMonth) => getEffectiveConstantsForPeriod(get().versions, yearMonth),
      getEffectiveConstants: (yearMonth) => {
        const version = getEffectiveConstantsForPeriod(get().versions, yearMonth);
        return toCalculationConstants(version);
      },
    }),
    {
      name: 'zlatarka-v2-constants-timeline',
      partialize: (state) => ({
        versions: state.versions,
        selectedYearMonth: state.selectedYearMonth,
      }),
    }
  )
);
