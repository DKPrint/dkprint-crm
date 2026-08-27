import type { Metadata } from 'next';
import { Open_Sans, Poppins } from 'next/font/google';
import './globals.css';

const poppins = Poppins({
  variable: '--font-head',
  // Poppins has no Cyrillic subset in next/font; Cyrillic headings fall back to body font.
  subsets: ['latin', 'latin-ext'],
  weight: ['500', '600', '700'],
});

const openSans = Open_Sans({
  variable: '--font-body',
  subsets: ['latin', 'cyrillic', 'latin-ext'],
  weight: ['400', '500', '600', '700'],
});
export const metadata: Metadata = {
  title: 'DKPrint CRM',
  description: 'Операционный CRM типографии DKPrint',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" className={`${poppins.variable} ${openSans.variable} h-full antialiased`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
