import type { Language } from './dictionaries';

export function localeForLanguage(language: Language): string {
  return language === 'sr-Cyrl' ? 'sr-Cyrl-RS' : 'en-US';
}

export function inputLocaleForLanguage(language: Language): string {
  return language === 'sr-Cyrl' ? 'sr-RS' : 'en-US';
}
