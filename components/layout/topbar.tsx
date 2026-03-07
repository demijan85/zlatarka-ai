'use client';

import { LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { createBrowserSupabaseClient } from '@/lib/supabase/browser';
import type { Language } from '@/lib/i18n/dictionaries';
import { useI18nStore } from '@/lib/i18n/store';
import { useTranslation } from '@/lib/i18n/use-translation';
import type { ThemeName } from '@/lib/theme/store';
import { useThemeStore } from '@/lib/theme/store';
import { Menu } from 'lucide-react';

export function Topbar({ onMenuToggle }: { onMenuToggle?: () => void }) {
  const router = useRouter();
  const { t, language } = useTranslation();
  const setLanguage = useI18nStore((state) => state.setLanguage);
  const theme = useThemeStore((state) => state.theme);
  const setTheme = useThemeStore((state) => state.setTheme);

  async function onLogout() {
    const supabase = createBrowserSupabaseClient();
    await supabase.auth.signOut();
    document.cookie = 'app_session=; Path=/; Max-Age=0; SameSite=Lax';
    document.cookie = 'app_user=; Path=/; Max-Age=0; SameSite=Lax';
    router.push('/login');
  }

  return (
    <header
      style={{
        height: 64,
        borderBottom: '1px solid var(--border)',
        background: 'var(--surface-strong)',
        backdropFilter: 'blur(10px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 16px',
        position: 'sticky',
        top: 0,
        zIndex: 5,
      }}
    >
      <div>
        <button className="btn mobile-menu-btn" onClick={onMenuToggle} aria-label={t('nav.toggle')}>
          <Menu size={16} />
        </button>
        <strong>{t('app.title')}</strong>
        <div className="muted" style={{ fontSize: 12 }}>
          {t('app.subtitle')}
        </div>
      </div>

      <div className="control-row">
        <label className="muted theme-select-label" htmlFor="theme-select" style={{ fontSize: 12 }}>
          {t('theme.select')}
        </label>
        <select
          id="theme-select"
          className="input"
          style={{ minWidth: 130 }}
          value={theme}
          onChange={(event) => setTheme(event.target.value as ThemeName)}
        >
          <option value="zlatar">{t('theme.zlatar')}</option>
          <option value="uvac">{t('theme.uvac')}</option>
          <option value="terra">{t('theme.terra')}</option>
        </select>

        <label className="muted" htmlFor="lang-select" style={{ fontSize: 12 }}>
          {t('lang.select')}
        </label>
        <select
          id="lang-select"
          className="input"
          style={{ minWidth: 190 }}
          value={language}
          onChange={(event) => setLanguage(event.target.value as Language)}
        >
          <option value="sr-Cyrl">{t('lang.sr')}</option>
          <option value="en">{t('lang.en')}</option>
        </select>

        <button className="btn" onClick={onLogout}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <LogOut size={14} /> {t('auth.logout')}
          </span>
        </button>
      </div>
    </header>
  );
}
