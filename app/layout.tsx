import type { Metadata } from 'next';
import { Great_Vibes, Cormorant_Garamond, Jost } from 'next/font/google';
import './globals.css';

const greatVibes = Great_Vibes({
  weight: '400',
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-great-vibes',
});

const cormorant = Cormorant_Garamond({
  weight: ['400', '500', '600'],
  style: ['normal', 'italic'],
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-cormorant',
});

const jost = Jost({
  weight: ['300', '400', '500'],
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-jost',
});

export const metadata: Metadata = {
  title: 'Ramiro & Juany · 19.09.2026',
  description: 'Nos casamos el 19 de septiembre de 2026. Subí tus fotos de la fiesta.',
};

export const viewport = {
  themeColor: '#2b2320',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-AR" className={`${greatVibes.variable} ${cormorant.variable} ${jost.variable}`}>
      <body>{children}</body>
    </html>
  );
}
