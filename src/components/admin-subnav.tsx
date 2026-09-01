import Link from 'next/link';

const links = [
  { href: '/admin/users', label: 'Пользователи' },
  { href: '/admin/catalog', label: 'Каталог' },
  { href: '/admin/sla', label: 'SLA' },
];

type Props = { current: string };

export function AdminSubNav({ current }: Props) {
  return (
    <nav className="subnav" aria-label="Администрирование">
      {links.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={current === item.href ? 'subnav-link subnav-link-active' : 'subnav-link'}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
