import React from 'react';
import { Loader2 } from 'lucide-react';

export type ButtonVariant =
  | 'primary'
  | 'default'
  | 'accent'
  | 'secondary'
  | 'outline'
  | 'ghost'
  | 'destructive';

export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  children: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      isLoading = false,
      disabled,
      children,
      className = '',
      ...props
    },
    ref,
  ) => {
    const variantStyles: Record<ButtonVariant, string> = {
      primary:
        'bg-park-900 text-white hover:bg-park-800 dark:bg-park-600 dark:hover:bg-park-500 shadow-xs focus-visible:ring-park-700',
      default:
        'bg-park-900 text-white hover:bg-park-800 dark:bg-park-600 dark:hover:bg-park-500 shadow-xs focus-visible:ring-park-700',
      accent:
        'bg-warmAmber-600 text-white hover:bg-warmAmber-700 dark:bg-warmAmber-500 dark:hover:bg-warmAmber-600 shadow-xs focus-visible:ring-warmAmber-600',
      secondary:
        'bg-slate-100 text-slate-900 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700 focus-visible:ring-slate-500',
      outline:
        'border border-slate-300 dark:border-slate-700 bg-transparent text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/60 focus-visible:ring-slate-400',
      ghost:
        'bg-transparent text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 focus-visible:ring-slate-400',
      destructive:
        'bg-rose-600 text-white hover:bg-rose-700 dark:bg-rose-700 dark:hover:bg-rose-800 shadow-xs focus-visible:ring-rose-500',
    };

    const sizeStyles: Record<ButtonSize, string> = {
      sm: 'px-2.5 py-1.5 text-xs font-medium rounded-lg gap-1.5',
      md: 'px-4 py-2 text-sm font-semibold rounded-lg gap-2',
      lg: 'px-5 py-2.5 text-base font-semibold rounded-xl gap-2.5',
    };

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        aria-busy={isLoading}
        className={`inline-flex items-center justify-center font-sans transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900 disabled:opacity-50 disabled:pointer-events-none active:scale-[0.98] cursor-pointer ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
        {...props}
      >
        {isLoading && <Loader2 className="w-4 h-4 animate-spin shrink-0" aria-hidden="true" />}
        {children}
      </button>
    );
  },
);

Button.displayName = 'Button';
