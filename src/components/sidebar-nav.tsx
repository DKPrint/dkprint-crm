'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { NavItem } from '@/lib/auth/nav';

function isActive(pathname: string, href: string): boolean {
  if (href.startsWith('/admin')) {
    return pathname === href || pathname.startsWith('/admin');
  }
  return pathname === href;
}

export function SidebarNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();

  return (
    <nav className="nav" aria-label="Основное меню">
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={`nav-btn${isActive(pathname, item.href) ? ' is-active' : ''}`}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
