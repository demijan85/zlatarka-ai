'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Language } from './dictionaries';

type I18nState = {
  language: Language;
  setLanguage: (language: Language) => void;
};

export const useI18nStore = create<I18nState>()(
  persist(
    (set) => ({
      language: 'sr-Cyrl',
      setLanguage: (language) => set({ language }),
    }),
    {
      name: 'zlatarka-v2-language',
      partialize: (state) => ({ language: state.language }),
    }
  )
);
