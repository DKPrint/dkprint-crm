import { signOut } from '@/auth';
import { MobileNavShell } from '@/components/mobile-nav-shell';
import type { NavItem } from '@/lib/auth/nav';
import type { Role } from '@/lib/auth/permissions';

type AppShellProps = {
  email: string;
  role: Role;
  navItems: NavItem[];
  children: React.ReactNode;
};

export function AppShell({ email, role, navItems, children }: AppShellProps) {
  const signOutForm = (
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
  );

  return (
    <MobileNavShell email={email} role={role} navItems={navItems} signOutForm={signOutForm}>
      {children}
    </MobileNavShell>
  );
}
