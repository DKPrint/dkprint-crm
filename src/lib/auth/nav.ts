import type { PermissionFlags, Role } from './permissions';

export type NavItem = { href: string; label: string };

type NavFlags = Pick<PermissionFlags, 'can_access_reports'>;

/** Role → visible sidebar items (TZ §16.2). Unavailable items are omitted. */
export function navItemsFor(role: Role, flags: NavFlags): NavItem[] {
  const items: NavItem[] = [
    { href: '/dashboard', label: 'Главная' },
    { href: '/orders', label: 'Заказы' },
  ];

  if (role === 'admin' || role === 'production' || role === 'photo_center') {
    items.push({ href: '/orders/new', label: 'Новый заказ' });
  }

  if (role === 'admin' || role === 'production' || role === 'designer') {
    items.push({ href: '/workshop', label: 'Очередь' });
  }

  if (role === 'admin' || role === 'production' || role === 'designer' || role === 'photo_center') {
    items.push({ href: '/tasks', label: 'Задачи' });
  }

  if (role === 'admin' || role === 'production' || role === 'designer') {
    items.push({ href: '/clients', label: 'Клиенты' });
  }

  const canReports =
    role === 'admin' ||
    ((role === 'production' || role === 'designer') && flags.can_access_reports);
  if (canReports) {
    items.push({ href: '/reports', label: 'Отчёты' });
  }

  if (role === 'admin') {
    items.push({ href: '/admin/catalog', label: 'Каталог' });
    items.push({ href: '/admin/users', label: 'Админка' });
  }

  return items;
}

/** Defense-in-depth: same matrix as nav; allow nested paths under an allowed item.
 * `/orders/new` is a separate nav right — not implied by `/orders`.
 */
export function canAccessHref(role: Role, flags: NavFlags, href: string): boolean {
  if (href === '/dashboard' || href.startsWith('/dashboard/')) {
    return true;
  }

  if (href.startsWith('/admin')) {
    return role === 'admin';
  }

  const items = navItemsFor(role, flags);

  if (href === '/orders/new' || href.startsWith('/orders/new/')) {
    return items.some((item) => item.href === '/orders/new');
  }

  return items.some((item) => href === item.href || href.startsWith(`${item.href}/`));
}
