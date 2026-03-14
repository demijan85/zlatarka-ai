'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useThemeStore } from '@/lib/theme/store';
import { NavigationGuardProvider } from './navigation-guard';
import { Sidebar } from './sidebar';
import { Topbar } from './topbar';

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const theme = useThemeStore((state) => state.theme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  if (pathname === '/login') {
    return <>{children}</>;
  }

  return (
    <NavigationGuardProvider>
      <div className="app-shell" style={{ display: 'grid', gridTemplateColumns: `${collapsed ? 72 : 240}px 1fr` }}>
        <Sidebar
          collapsed={collapsed}
          onToggle={() => setCollapsed((prev) => !prev)}
          mobileOpen={mobileNavOpen}
          onCloseMobile={() => setMobileNavOpen(false)}
        />
        {mobileNavOpen ? <button className="mobile-nav-backdrop" onClick={() => setMobileNavOpen(false)} aria-label="Close menu" /> : null}
        <main style={{ minHeight: '100vh' }}>
          <Topbar onMenuToggle={() => setMobileNavOpen((prev) => !prev)} />
          <div style={{ padding: 16 }}>{children}</div>
        </main>
      </div>
    </NavigationGuardProvider>
  );
}
