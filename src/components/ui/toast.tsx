'use client';

import * as React from 'react';

import { cn } from '@/lib/utils';

type ToastVariant = 'success' | 'error' | 'info';

export type ToastPayload = {
  id?: string;
  title: string;
  description?: string;
  variant?: ToastVariant;
};

type ToastContextValue = {
  toasts: ToastPayload[];
  push: (toast: ToastPayload) => void;
  remove: (id: string) => void;
};

const ToastContext = React.createContext<ToastContextValue | null>(null);

export const ToastProvider = ({ children }: { children: React.ReactNode }) => {
  const [toasts, setToasts] = React.useState<ToastPayload[]>([]);

  const remove = React.useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const push = React.useCallback(
    (toast: ToastPayload) => {
      const id = toast.id ?? `toast_${Date.now()}_${Math.random().toString(16).slice(2)}`;
      setToasts((current) => [...current, { ...toast, id }]);
      window.setTimeout(() => remove(id), 4000);
    },
    [remove],
  );

  return <ToastContext.Provider value={{ toasts, push, remove }}>{children}</ToastContext.Provider>;
};

export const useToast = () => {
  const context = React.useContext(ToastContext);
  if (!context) {
    return {
      toasts: [],
      push: () => undefined,
      remove: () => undefined,
    } satisfies ToastContextValue;
  }
  return context;
};

const variantStyles: Record<ToastVariant, string> = {
  success: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  error: 'border-red-200 bg-red-50 text-red-900',
  info: 'border-slate-200 bg-white text-foreground',
};

export const ToastViewport = () => {
  const context = React.useContext(ToastContext);
  if (!context) {
    return null;
  }

  return (
    <div className="fixed right-4 top-4 z-[60] flex w-80 flex-col gap-2">
      {context.toasts.map((toast) => (
        <div
          key={toast.id}
          className={cn(
            'rounded-xl border px-4 py-3 text-sm shadow-sm',
            variantStyles[toast.variant ?? 'info'],
          )}
        >
          <p className="font-semibold">{toast.title}</p>
          {toast.description ? (
            <p className="mt-1 text-xs text-muted-foreground">{toast.description}</p>
          ) : null}
        </div>
      ))}
    </div>
  );
};
