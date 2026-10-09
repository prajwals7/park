import './globals.css';
import type { Metadata } from 'next';
import { ThemeProvider } from '../components/ui/theme-provider';
import { ToastProvider } from '../components/ui/toast';
import { AuthProvider } from '../context/auth-context';

export const metadata: Metadata = {
  title: 'Walker Pass Desk',
  description: 'Gate pass and renewal desk management system for walking parks',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 antialiased font-sans">
        <ThemeProvider>
          <ToastProvider>
            <AuthProvider>{children}</AuthProvider>
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
