import Link from 'next/link';
import { signOut } from '@/auth';
import { SidebarNav } from '@/components/sidebar-nav';
import type { NavItem } from '@/lib/auth/nav';
import type { Role } from '@/lib/auth/permissions';

type AppShellProps = {
  email: string;
  role: Role;
  navItems: NavItem[];
  children: React.ReactNode;
};

export function AppShell({ email, role, navItems, children }: AppShellProps) {
  return (
    <div className="app">
      <aside className="sidebar">
        <Link href="/orders" className="brand">
          <span className="brand-mark">DK</span>
          <span>
            <span className="brand-name">DKPrint CRM</span>
            <span className="brand-sub">операционный CRM</span>
          </span>
        </Link>
        <SidebarNav items={navItems} />
      </aside>

      <header className="header">
        <p className="header-title">
          {email} · {role}
        </p>
        <div className="header-right">
          <form
            action={async () => {
              'use server';
              await signOut({ redirectTo: '/login' });
            }}
          >
            <button type="submit" className="btn btn-ghost">
              Выйти
            </button>
          </form>
        </div>
      </header>

      <main className="main">{children}</main>
    </div>
  );
}
