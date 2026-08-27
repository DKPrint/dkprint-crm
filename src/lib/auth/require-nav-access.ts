import { redirect } from 'next/navigation';
import { canAccessHref } from './nav';
import { requireAuth } from './requireAuth';

/** requireAuth + nav matrix; redirects to /login or /orders. */
export async function requireNavAccess(href: string) {
  const session = await requireAuth();
  if (!session) {
    redirect('/login');
  }
  if (!canAccessHref(session.user.role, session.flags, href)) {
    redirect('/orders');
  }
  return session;
}
