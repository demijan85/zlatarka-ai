'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ThemeName = 'zlatar' | 'uvac' | 'terra';

type ThemeState = {
  theme: ThemeName;
  setTheme: (theme: ThemeName) => void;
};

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      theme: 'zlatar',
      setTheme: (theme) => set({ theme }),
    }),
    {
      name: 'zlatarka-v2-theme',
      partialize: (state) => ({ theme: state.theme }),
    }
  )
);
