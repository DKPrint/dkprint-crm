/** Sidebar nav active state (TZ §16.2 UX). Pure — testable without React. */
export function isNavItemActive(pathname: string, href: string): boolean {
  if (pathname === href) return true;

  if (href === '/orders') {
    if (!pathname.startsWith('/orders/')) return false;
    return !(pathname === '/orders/new' || pathname.startsWith('/orders/new/'));
  }

  if (href === '/admin/users') {
    if (pathname.startsWith('/admin/users/')) return true;
    if (pathname === '/admin/sla' || pathname.startsWith('/admin/sla/')) return true;
    if (pathname === '/admin') return true;
    return false;
  }

  if (href === '/admin/catalog') {
    return pathname.startsWith('/admin/catalog/');
  }

  return pathname.startsWith(`${href}/`);
}
