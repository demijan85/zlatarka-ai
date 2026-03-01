'use client';

import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { Sidebar } from './sidebar';
import { Topbar } from './topbar';

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  if (pathname === '/login') {
    return <>{children}</>;
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: `${collapsed ? 72 : 240}px 1fr` }}>
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((prev) => !prev)} />
      <main style={{ minHeight: '100vh' }}>
        <Topbar />
        <div style={{ padding: 16 }}>{children}</div>
      </main>
    </div>
  );
}
