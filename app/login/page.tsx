'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserSupabaseClient } from '@/lib/supabase/browser';
import { useTranslation } from '@/lib/i18n/use-translation';

export default function LoginPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError('');

    const supabase = createBrowserSupabaseClient();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }

    const maxAge = data.session?.expires_in ?? 24 * 60 * 60;
    const actorIdentifier = data.user?.email ?? email;
    document.cookie = `app_session=1; Path=/; Max-Age=${maxAge}; SameSite=Lax`;
    document.cookie = `app_user=${encodeURIComponent(actorIdentifier)}; Path=/; Max-Age=${maxAge}; SameSite=Lax`;
    router.push('/daily-entry');
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        background: 'radial-gradient(circle at top, #ccfbf1, #eff6ff 45%, #f8fafc)',
      }}
    >
      <form className="card" onSubmit={onSubmit} style={{ width: 360, padding: 20, display: 'grid', gap: 12 }}>
        <h1 style={{ margin: 0, fontSize: 24 }}>{t('auth.loginTitle')}</h1>
        <p className="muted" style={{ margin: 0 }}>
          {t('auth.loginSubtitle')}
        </p>

        <input
          className="input"
          type="email"
          placeholder={t('auth.email')}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          className="input"
          type="password"
          placeholder={t('auth.password')}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        {error ? <div style={{ color: 'var(--danger)', fontSize: 14 }}>{error}</div> : null}

        <button className="btn primary" type="submit" disabled={loading}>
          {loading ? t('auth.signingIn') : t('auth.login')}
        </button>
      </form>
    </div>
  );
}
