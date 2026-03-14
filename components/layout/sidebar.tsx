'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
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
  ShoppingCart,
  Truck,
  Users,
  Workflow,
  type LucideIcon,
} from 'lucide-react';
import clsx from 'clsx';
import { useTranslation } from '@/lib/i18n/use-translation';
import { useNavigationVisibilityStore } from '@/lib/navigation/store';
import { useNavigationGuard } from './navigation-guard';

type NavItem = {
  id?: string;
  href: string;
  label: string;
  icon: LucideIcon;
  optional?: boolean;
};

type NavSection = {
  id: string;
  title: string;
  items: NavItem[];
};

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
  const router = useRouter();
  const pathname = usePathname();
  const { t } = useTranslation();
  const { requestNavigation } = useNavigationGuard();
  const hiddenSectionIds = useNavigationVisibilityStore((state) => state.hiddenSectionIds);
  const hiddenItemIds = useNavigationVisibilityStore((state) => state.hiddenItemIds);

  const navSections: NavSection[] = [
    {
      id: 'purchase',
      title: t('nav.sectionPurchase'),
      items: [
        { id: 'dashboard', href: '/dashboard', label: t('nav.dashboard'), icon: LayoutDashboard },
        { id: 'daily-entry', href: '/daily-entry', label: t('nav.daily'), icon: Truck },
        { id: 'monthly-view', href: '/monthly-view', label: t('nav.monthly'), icon: CalendarDays },
        { id: 'quarterly-view', href: '/quarterly-view', label: t('nav.quarterly'), icon: BarChart3 },
        { id: 'supplier-history', href: '/supplier-history', label: t('nav.producerHistory'), icon: History },
      ],
    },
    {
      id: 'purchase-admin',
      title: t('nav.sectionPurchaseAdmin'),
      items: [
        { id: 'corrections', href: '/corrections', label: t('nav.corrections'), icon: ClipboardCheck, optional: true },
        { id: 'suppliers', href: '/suppliers', label: t('nav.suppliers'), icon: Users, optional: true },
        { id: 'constants', href: '/settings', label: t('nav.constants'), icon: Settings, optional: true },
        { id: 'audit-logs', href: '/audit-logs', label: t('nav.auditLogs'), icon: FileClock, optional: true },
      ],
    },
    {
      id: 'production',
      title: t('nav.sectionProduction'),
      items: [
        { id: 'production-dashboard', href: '/production/dashboard', label: t('nav.productionDashboard'), icon: LayoutDashboard },
        { id: 'production-entry', href: '/production/daily-entry', label: t('nav.productionEntry'), icon: ClipboardList },
        { id: 'production-products', href: '/production/products', label: t('nav.productionProducts'), icon: Package, optional: true },
        { id: 'production-reports', href: '/production/reports', label: t('nav.productionReports'), icon: BarChart3 },
        { id: 'production-traceability', href: '/production/traceability', label: t('nav.traceability'), icon: Workflow },
      ],
    },
    {
      id: 'sales',
      title: t('nav.sectionSales'),
      items: [
        { id: 'sales-dashboard', href: '/sales/dashboard', label: t('nav.salesInventory'), icon: Package },
        { id: 'sales-deliveries', href: '/sales/deliveries', label: t('nav.salesDeliveries'), icon: Truck },
        { id: 'sales-customers', href: '/sales/customers', label: t('nav.salesCustomers'), icon: ShoppingCart },
      ],
    },
    {
      id: 'workspace',
      title: t('nav.sectionWorkspace'),
      items: [{ href: '/menu-settings', label: t('nav.menuSettings'), icon: Settings }],
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
        zIndex: 80,
        overflow: 'visible',
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
        {navSections
          .map((section) => ({
            ...section,
            visibleItems: section.items.filter((item) => !item.id || !hiddenItemIds.includes(item.id)),
          }))
          .filter((section) => !hiddenSectionIds.includes(section.id) && section.visibleItems.length > 0)
          .map((section) => (
          <div key={section.title} className="sidebar-section">
            {!collapsed ? <div className="sidebar-section-title">{section.title}</div> : <div className="sidebar-section-divider" />}

            <div style={{ display: 'grid', gap: 8 }}>
              {section.visibleItems.map((item) => {
                const Icon = item.icon;
                const active = pathname === item.href || pathname.startsWith(`${item.href}/`);

                return (
                  <div key={item.href} className="sidebar-link-shell">
                    <Link
                      href={item.href}
                      onClick={(event) => {
                        if (active) {
                          onCloseMobile();
                          return;
                        }

                        event.preventDefault();
                        requestNavigation(() => {
                          onCloseMobile();
                          router.push(item.href);
                        });
                      }}
                      className={clsx('btn sidebar-link', { primary: active })}
                      aria-label={collapsed ? item.label : undefined}
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
                    {collapsed ? <span className="sidebar-link-tooltip">{item.label}</span> : null}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
    </aside>
  );
}
