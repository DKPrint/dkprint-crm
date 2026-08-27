import { redirect } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { navItemsFor } from '@/lib/auth/nav';
import { requireAuth } from '@/lib/auth/requireAuth';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireAuth();
  if (!session) {
    redirect('/login');
  }

  const { email, role } = session.user;
  const navItems = navItemsFor(role, session.flags);

  return (
    <AppShell email={email ?? ''} role={role} navItems={navItems}>
      {children}
    </AppShell>
  );
}
