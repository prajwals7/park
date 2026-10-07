import './globals.css';
import type { Metadata } from 'next';
import { ThemeProvider } from '../components/ui/theme-provider';
import { ToastProvider } from '../components/ui/toast';

export const metadata: Metadata = {
  title: 'Walker Pass Desk',
  description: 'Gate pass and renewal desk management system for walking parks',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 antialiased font-sans">
        <ThemeProvider>
          <ToastProvider>{children}</ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
