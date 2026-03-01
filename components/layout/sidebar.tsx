'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BarChart3, CalendarDays, ChevronLeft, ChevronRight, Factory, Settings, Truck, Users } from 'lucide-react';
import clsx from 'clsx';
import { useTranslation } from '@/lib/i18n/use-translation';

export function Sidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const pathname = usePathname();
  const { t } = useTranslation();

  const navItems = [
    { href: '/daily-entry', label: t('nav.daily'), icon: Truck },
    { href: '/monthly-view', label: t('nav.monthly'), icon: CalendarDays },
    { href: '/quarterly-view', label: t('nav.quarterly'), icon: BarChart3 },
    { href: '/suppliers', label: t('nav.suppliers'), icon: Users },
    { href: '/settings', label: t('nav.constants'), icon: Settings },
  ];

  return (
    <aside
      style={{
        width: collapsed ? 72 : 240,
        transition: 'width 0.2s ease',
        borderRight: '1px solid var(--border)',
        background: 'white',
        minHeight: '100vh',
        padding: 12,
        position: 'sticky',
        top: 0,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Factory size={20} />
          {!collapsed && <strong>{t('app.brand')}</strong>}
        </div>
        <button className="btn" onClick={onToggle} aria-label={t('nav.toggle')}>
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      <nav style={{ display: 'grid', gap: 8 }}>
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={clsx('btn', { primary: active })}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                justifyContent: collapsed ? 'center' : 'flex-start',
              }}
            >
              <Icon size={16} />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
