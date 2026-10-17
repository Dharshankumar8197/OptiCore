import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  weight: ['200', '300', '400', '500', '600'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'OPTICORE — Vision Lab',
  description: 'Local AI Vision System',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body style={{ background: '#07080C', overflow: 'hidden', height: '100vh' }}>
        {children}
      </body>
    </html>
  );
}
