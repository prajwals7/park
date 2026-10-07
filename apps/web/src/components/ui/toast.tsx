'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastItem {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
}

export interface ToastOptions {
  type?: ToastType;
  variant?: 'default' | 'destructive' | 'success' | 'warning';
  title: string;
  message?: string;
  description?: string;
  durationMs?: number;
}

interface ToastContextType {
  toast: (options: ToastOptions) => void;
  addToast: (options: ToastOptions) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    ({
      type,
      variant,
      title,
      message,
      description,
      durationMs = 4000,
    }: ToastOptions) => {
      let resolvedType: ToastType = type || 'info';
      if (variant === 'destructive') resolvedType = 'error';
      else if (variant === 'success') resolvedType = 'success';
      else if (variant === 'warning') resolvedType = 'warning';

      const id = Math.random().toString(36).substring(2, 9);
      setToasts((prev) => [
        ...prev,
        { id, type: resolvedType, title, message: description || message },
      ]);

      if (durationMs > 0) {
        setTimeout(() => {
          removeToast(id);
        }, durationMs);
      }
    },
    [removeToast],
  );

  return (
    <ToastContext.Provider value={{ toast, addToast: toast, removeToast }}>
      {children}
      {/* Toast viewport container with ARIA Live */}
      <div
        aria-live="polite"
        aria-atomic="true"
        className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none p-4"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className="pointer-events-auto flex items-start gap-3 p-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-lg animate-in slide-in-from-bottom-5 duration-200"
          >
            {t.type === 'success' && (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            )}
            {t.type === 'error' && (
              <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
            )}
            {t.type === 'warning' && (
              <AlertTriangle className="w-5 h-5 text-warmAmber-600 dark:text-warmAmber-400 shrink-0 mt-0.5" />
            )}
            {t.type === 'info' && (
              <Info className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
            )}

            <div className="flex-1 text-xs">
              <div className="font-bold text-slate-900 dark:text-slate-100">{t.title}</div>
              {t.message && (
                <div className="text-slate-600 dark:text-slate-400 mt-0.5">{t.message}</div>
              )}
            </div>

            <button
              type="button"
              onClick={() => removeToast(t.id)}
              aria-label="Dismiss notification"
              className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
