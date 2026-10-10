'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { UserPlus, Users, BarChart3, Moon, Sun, Palette, TreePine, LogOut } from 'lucide-react';
import { useTheme } from '../ui/theme-provider';
import { useAuth } from '../../context/auth-context';

export type UserRole = 'ADMIN' | 'COLLECTOR';

export interface AppShellProps {
  children: React.ReactNode;
  activeRole: UserRole;
  onRoleChange: (role: UserRole) => void;
  activeGate?: string;
  onGateChange?: (gate: string) => void;
}

export function AppShell({
  children,
  activeRole,
  onRoleChange: _onRoleChange,
  activeGate = 'G2',
  onGateChange,
}: AppShellProps) {
  const pathname = usePathname();
  const { resolvedTheme, toggleTheme } = useTheme();
  const { user, logout } = useAuth();

  // Navigation Items
  const adminNavItems = [
    { label: 'Walkers Desk', href: '/', icon: Users },
    { label: 'Register Walker', href: '/#register', icon: UserPlus },
    { label: 'Reports & Exports', href: '/#reports', icon: BarChart3 },
    { label: 'Design System', href: '/design', icon: Palette },
  ];

  const collectorNavItems = [
    { label: 'Pass Desk', href: '/', icon: Users },
    { label: 'Fast Register', href: '/#register', icon: UserPlus },
    { label: 'Design System', href: '/design', icon: Palette },
  ];

  const navItems = activeRole === 'ADMIN' ? adminNavItems : collectorNavItems;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col md:flex-row transition-colors duration-200">
      {/* ============================================================ */}
      {/* DESKTOP SIDEBAR (Wide sidebar layout for admins / desktop)   */}
      {/* ============================================================ */}
      <aside className="hidden md:flex flex-col w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 shrink-0 sticky top-0 h-screen z-30">
        {/* Brand Header */}
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-park-900 dark:bg-park-600 text-white flex items-center justify-center shadow-md shrink-0">
            <TreePine className="w-5 h-5 text-emerald-300" />
          </div>
          <div>
            <h1 className="text-sm font-extrabold tracking-tight text-slate-900 dark:text-slate-100 leading-tight">
              Walker Pass Desk
            </h1>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
              Park Ticketing System
            </p>
          </div>
        </div>

        {/* Gate Badge & Role Selector */}
        <div className="p-4 bg-slate-50/70 dark:bg-slate-800/40 border-b border-slate-100 dark:border-slate-800 space-y-2.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500 dark:text-slate-400 font-semibold uppercase text-[10px] tracking-wider">
              Assigned Gate
            </span>
            {onGateChange ? (
              <select
                value={activeGate}
                onChange={(e) => onGateChange(e.target.value)}
                className="text-xs font-bold text-park-900 dark:text-park-300 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded px-1.5 py-0.5"
              >
                <option value="G2">Gate G2</option>
                <option value="GS">Gate GS</option>
                <option value="G9">Gate G9</option>
              </select>
            ) : (
              <span className="font-bold text-park-900 dark:text-park-300 bg-park-100 dark:bg-park-900/60 px-2 py-0.5 rounded text-[11px]">
                Gate {activeGate}
              </span>
            )}
          </div>

          <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-200/60 dark:border-slate-700/60">
            <span className="text-slate-500 dark:text-slate-400 font-semibold uppercase text-[10px] tracking-wider">
              Role
            </span>
            <span
              className={`px-2 py-0.5 rounded text-[11px] font-extrabold uppercase tracking-wide ${
                (user?.role || activeRole) === 'ADMIN' || (user?.role || activeRole) === 'SUPER_ADMIN'
                  ? 'bg-amber-100 text-amber-900 dark:bg-amber-950/80 dark:text-amber-300 border border-amber-300 dark:border-amber-700'
                  : 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700'
              }`}
            >
              {user?.role || activeRole}
            </span>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.label}
                href={item.href}
                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-colors duration-150 ${
                  isActive
                    ? 'bg-park-50 dark:bg-park-950/60 text-park-900 dark:text-park-300 font-bold border border-park-200 dark:border-park-800'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                <Icon
                  className={`w-4 h-4 ${isActive ? 'text-park-700 dark:text-park-400' : 'text-slate-400'}`}
                />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Bottom User & Theme Footer */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="w-8 h-8 rounded-full bg-park-100 dark:bg-park-900 text-park-800 dark:text-park-200 flex items-center justify-center font-bold text-xs shrink-0">
              {user?.name ? user.name.slice(0, 2).toUpperCase() : activeRole === 'ADMIN' ? 'AD' : 'CL'}
            </div>
            <div className="text-xs truncate">
              <div className="font-bold text-slate-800 dark:text-slate-200 leading-none truncate">
                {user?.name || (activeRole === 'ADMIN' ? 'Supervisor' : 'Gate Collector')}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5 truncate">{user?.email || 'Shift Active'}</div>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={toggleTheme}
              aria-label="Toggle light/dark theme"
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-park-700"
            >
              {resolvedTheme === 'dark' ? (
                <Sun className="w-4 h-4 text-amber-400" />
              ) : (
                <Moon className="w-4 h-4 text-slate-600" />
              )}
            </button>
            <button
              type="button"
              onClick={logout}
              aria-label="Log Out"
              title="Log Out"
              className="p-1.5 rounded-lg text-red-500 hover:text-red-700 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* ============================================================ */}
      {/* MOBILE HEADER                                               */}
      {/* ============================================================ */}
      <header className="md:hidden bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-30 px-4 h-14 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-park-900 text-white flex items-center justify-center font-bold text-xs">
            WP
          </div>
          <div>
            <h1 className="text-xs font-bold leading-tight truncate max-w-[140px]">
              {user?.name || 'Walker Pass Desk'}
            </h1>
            <span className="text-[10px] text-park-700 dark:text-park-400 font-semibold">
              Gate {activeGate} • {user?.role || activeRole}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={toggleTheme}
            aria-label="Toggle theme"
            className="p-1.5 text-slate-500 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            {resolvedTheme === 'dark' ? (
              <Sun className="w-4 h-4 text-amber-400" />
            ) : (
              <Moon className="w-4 h-4" />
            )}
          </button>
          <span
            className="text-[10px] font-extrabold uppercase px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 rounded-md"
          >
            {user?.role || activeRole}
          </span>
          <button
            type="button"
            onClick={logout}
            aria-label="Log Out"
            title="Log Out"
            className="p-1.5 text-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/40"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* ============================================================ */}
      {/* MAIN VIEW CONTENT AREA                                       */}
      {/* ============================================================ */}
      <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8 pb-20 md:pb-8">{children}</main>

      {/* ============================================================ */}
      {/* MOBILE BOTTOM NAVIGATION (Mobile-first for collectors)      */}
      {/* ============================================================ */}
      <nav
        aria-label="Mobile navigation"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 flex items-center justify-around h-14 px-2 safe-bottom"
      >
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.label}
              href={item.href}
              className={`flex flex-col items-center justify-center w-full h-full py-1 text-[10px] font-semibold transition-colors ${
                isActive
                  ? 'text-park-900 dark:text-park-400 font-bold'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              <Icon className="w-4 h-4 mb-0.5" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
