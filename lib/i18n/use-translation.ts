'use client';

import { dictionaries } from './dictionaries';
import { useI18nStore } from './store';

export function useTranslation() {
  const language = useI18nStore((state) => state.language);

  function t(key: string): string {
    return dictionaries[language][key] ?? key;
  }

  return { t, language };
}
