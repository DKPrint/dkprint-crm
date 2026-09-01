'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { isNavItemActive } from '@/components/nav-active';
import type { NavItem } from '@/lib/auth/nav';

export function SidebarNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();

  return (
    <nav className="nav" aria-label="Основное меню">
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={`nav-btn${isNavItemActive(pathname, item.href) ? ' is-active' : ''}`}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
