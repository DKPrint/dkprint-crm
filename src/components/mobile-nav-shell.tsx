'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { PushSubscribeBanner } from '@/components/push-subscribe-banner';
import { SidebarNav } from '@/components/sidebar-nav';
import { ROLE_LABELS } from '@/lib/admin-users/labels';
import type { NavItem } from '@/lib/auth/nav';
import type { Role } from '@/lib/auth/permissions';

type Props = {
  email: string;
  role: Role;
  navItems: NavItem[];
  signOutForm: React.ReactNode;
  children: React.ReactNode;
};

const SIDEBAR_ID = 'app-sidebar';

export function MobileNavShell({ email, role, navItems, signOutForm, children }: Props) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const closeSidebar = useCallback(() => setSidebarOpen(false), []);
  const roleLabel = ROLE_LABELS[role];

  useEffect(() => {
    if (!sidebarOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeSidebar();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [sidebarOpen, closeSidebar]);

  useEffect(() => {
    if (!sidebarOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [sidebarOpen]);

  return (
    <div className="app">
      {sidebarOpen ? (
        <button
          type="button"
          className="sidebar-backdrop"
          aria-label="Закрыть меню"
          onClick={closeSidebar}
        />
      ) : null}

      <aside id={SIDEBAR_ID} className={`sidebar${sidebarOpen ? ' is-open' : ''}`}>
        <Link href="/orders" className="brand" onClick={closeSidebar}>
          <span className="brand-mark">DK</span>
          <span>
            <span className="brand-name">DKPrint CRM</span>
            <span className="brand-sub">операционный CRM</span>
          </span>
        </Link>
        <SidebarNav items={navItems} onNavigate={closeSidebar} />
      </aside>

      <header className="header">
        <div className="header-left">
          <button
            type="button"
            className="menu-toggle"
            aria-expanded={sidebarOpen}
            aria-controls={SIDEBAR_ID}
            aria-label={sidebarOpen ? 'Закрыть меню' : 'Открыть меню'}
            onClick={() => setSidebarOpen((open) => !open)}
          >
            <span className="menu-toggle-icon" aria-hidden="true">
              ☰
            </span>
          </button>
          <span className="header-mobile-brand">DKPrint</span>
        </div>
        <p className="header-title">
          <span className="header-title-email">{email}</span>
          <span className="header-title-sep"> · </span>
          <span className="header-title-role">{roleLabel}</span>
        </p>
        <div className="header-right">{signOutForm}</div>
      </header>

      <main className="main">
        <PushSubscribeBanner />
        {children}
      </main>
    </div>
  );
}
