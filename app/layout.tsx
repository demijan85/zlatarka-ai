import './globals.css';
import { AppShell } from '@/components/layout/app-shell';
import { QueryProvider } from '@/components/layout/query-provider';

export const metadata = {
  title: 'Zlatarka v2',
  description: 'Milk purchase operations app',
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
