import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Pandemic Legacy S2 Deck Counter',
  description: 'Track infection deck state for Pandemic Legacy Season 2.'
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
