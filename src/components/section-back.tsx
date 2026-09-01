import Link from 'next/link';

type Props = {
  href: string;
  label: string;
};

export function SectionBack({ href, label }: Props) {
  return (
    <Link href={href} className="section-back linkish">
      ← {label}
    </Link>
  );
}
