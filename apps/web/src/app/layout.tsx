import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-sans',
});

export const metadata: Metadata = {
  title: 'HappiTime',
  description: 'Venue management platform for Happy Hour marketing and foot traffic analytics.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      {/* Some browser extensions (e.g., grammar/spellcheck tools) mutate <body> before hydration. */}
      <body suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
