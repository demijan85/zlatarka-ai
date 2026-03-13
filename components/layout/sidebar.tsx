'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BarChart3,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  ClipboardList,
  Factory,
  FileClock,
  History,
  LayoutDashboard,
  Package,
  Settings,
  Truck,
  Users,
  Workflow,
} from 'lucide-react';
import clsx from 'clsx';
import { useTranslation } from '@/lib/i18n/use-translation';

export function Sidebar({
  collapsed,
  onToggle,
  mobileOpen,
  onCloseMobile,
}: {
  collapsed: boolean;
  onToggle: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}) {
  const pathname = usePathname();
  const { t } = useTranslation();

  const navSections = [
    {
      title: t('nav.sectionPurchase'),
      items: [
        { href: '/dashboard', label: t('nav.dashboard'), icon: LayoutDashboard },
        { href: '/daily-entry', label: t('nav.daily'), icon: Truck },
        { href: '/monthly-view', label: t('nav.monthly'), icon: CalendarDays },
        { href: '/supplier-history', label: t('nav.producerHistory'), icon: History },
        { href: '/quarterly-view', label: t('nav.quarterly'), icon: BarChart3 },
      ],
    },
    {
      title: t('nav.sectionPurchaseAdmin'),
      items: [
        { href: '/corrections', label: t('nav.corrections'), icon: ClipboardCheck },
        { href: '/suppliers', label: t('nav.suppliers'), icon: Users },
        { href: '/settings', label: t('nav.constants'), icon: Settings },
        { href: '/audit-logs', label: t('nav.auditLogs'), icon: FileClock },
      ],
    },
    {
      title: t('nav.sectionProduction'),
      items: [
        { href: '/production/dashboard', label: t('nav.productionDashboard'), icon: LayoutDashboard },
        { href: '/production/daily-entry', label: t('nav.productionEntry'), icon: ClipboardList },
        { href: '/production/reports', label: t('nav.productionReports'), icon: Package },
        { href: '/production/traceability', label: t('nav.traceability'), icon: Workflow },
      ],
    },
  ];

  return (
    <aside
      className={clsx('sidebar-shell', { 'mobile-open': mobileOpen })}
      style={{
        width: collapsed ? 72 : 240,
        transition: 'width 0.2s ease',
        borderRight: '1px solid var(--border)',
        background: 'var(--surface-strong)',
        minHeight: '100vh',
        padding: 12,
        position: 'sticky',
        top: 0,
        backdropFilter: 'blur(10px)',
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

      <nav className="sidebar-nav">
        {navSections.map((section) => (
          <div key={section.title} className="sidebar-section">
            {!collapsed ? <div className="sidebar-section-title">{section.title}</div> : <div className="sidebar-section-divider" />}

            <div style={{ display: 'grid', gap: 8 }}>
              {section.items.map((item) => {
                const Icon = item.icon;
                const active = pathname === item.href || pathname.startsWith(`${item.href}/`);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onCloseMobile}
                    className={clsx('btn sidebar-link', { primary: active })}
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
            </div>
          </div>
        ))}
      </nav>
    </aside>
  );
}
