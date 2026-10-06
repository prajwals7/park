import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Walker Pass Desk',
  description: 'Gate pass and renewal desk management system',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 antialiased">{children}</body>
    </html>
  );
}
