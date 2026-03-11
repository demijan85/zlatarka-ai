import './globals.css';
import type { Metadata } from 'next';
import { AppShell } from '@/components/layout/app-shell';
import { QueryProvider } from '@/components/layout/query-provider';

export const metadata: Metadata = {
  title: 'Zlatarka',
  description: 'Milk purchase and production operations app',
  icons: {
    icon: '/icon.svg',
    shortcut: '/icon.svg',
    apple: '/icon.svg',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="sr-Cyrl">
      <body>
        <QueryProvider>
          <AppShell>{children}</AppShell>
        </QueryProvider>
      </body>
    </html>
  );
}
