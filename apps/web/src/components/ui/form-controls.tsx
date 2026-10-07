import React from 'react';

export interface FormItemProps {
  label?: string;
  error?: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}

export function FormItem({
  label,
  error,
  hint,
  required,
  children,
  className = '',
}: FormItemProps) {
  return (
    <div className={`space-y-1.5 ${className}`}>
      {label && (
        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
          {label} {required && <span className="text-rose-500">*</span>}
        </label>
      )}
      {children}
      {hint && !error && <p className="text-[11px] text-slate-500 dark:text-slate-400">{hint}</p>}
      {error && (
        <p
          className="text-xs font-medium text-rose-600 dark:text-rose-400 flex items-center gap-1"
          role="alert"
        >
          {error}
        </p>
      )}
    </div>
  );
}

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className = '', error, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={`w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border rounded-lg transition-colors placeholder:text-slate-400 text-slate-900 dark:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-park-700 dark:focus-visible:ring-park-400 disabled:opacity-50 disabled:bg-slate-50 dark:disabled:bg-slate-950 ${
          error
            ? 'border-rose-500 dark:border-rose-600 focus-visible:ring-rose-500'
            : 'border-slate-300 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-600'
        } ${className}`}
        {...props}
      />
    );
  },
);
Input.displayName = 'Input';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className = '', error, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        className={`w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border rounded-lg transition-colors placeholder:text-slate-400 text-slate-900 dark:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-park-700 dark:focus-visible:ring-park-400 disabled:opacity-50 ${
          error
            ? 'border-rose-500 dark:border-rose-600 focus-visible:ring-rose-500'
            : 'border-slate-300 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-600'
        } ${className}`}
        {...props}
      />
    );
  },
);
Textarea.displayName = 'Textarea';

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  error?: boolean;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className = '', error, children, ...props }, ref) => {
    return (
      <select
        ref={ref}
        className={`w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border rounded-lg transition-colors text-slate-900 dark:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-park-700 dark:focus-visible:ring-park-400 disabled:opacity-50 ${
          error
            ? 'border-rose-500 dark:border-rose-600 focus-visible:ring-rose-500'
            : 'border-slate-300 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-600'
        } ${className}`}
        {...props}
      >
        {children}
      </select>
    );
  },
);
Select.displayName = 'Select';
