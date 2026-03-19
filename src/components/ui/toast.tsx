'use client';

import * as React from 'react';
import { X } from 'lucide-react';

import { cn } from '@/lib/utils';

type ToastVariant = 'success' | 'error' | 'info';
type ToastKind = 'default' | 'starReaction';

type StarReactionToastData = {
  displayName: string;
  subtitle: string;
  message: string;
  headshotUrl?: string | null;
};

export type ToastPayload = {
  id?: string;
  title?: string;
  description?: string;
  variant?: ToastVariant;
  kind?: ToastKind;
  durationMs?: number;
  starReaction?: StarReactionToastData;
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
      setToasts((current) => {
        const nextToast = { ...toast, id };
        const existingIndex = current.findIndex((entry) => entry.id === id);
        if (existingIndex === -1) {
          return [...current, nextToast];
        }
        const next = [...current];
        next[existingIndex] = nextToast;
        return next;
      });
      window.setTimeout(() => remove(id), toast.durationMs ?? 4000);
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

const StarReactionToastCard = ({
  toast,
  onClose,
}: {
  toast: ToastPayload & { id: string; starReaction: StarReactionToastData };
  onClose: () => void;
}) => (
  <div className="rounded-2xl border border-border bg-white p-4 text-sm shadow-xl">
    <div className="flex items-start gap-3">
      {toast.starReaction.headshotUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={toast.starReaction.headshotUrl}
          alt={toast.starReaction.displayName}
          className="mt-0.5 h-10 w-10 shrink-0 rounded-full object-cover"
        />
      ) : (
        <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-semibold text-slate-600">
          {toast.starReaction.displayName.charAt(0)}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate font-semibold text-foreground">{toast.starReaction.displayName}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{toast.starReaction.subtitle}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-full p-1 text-muted-foreground transition hover:bg-slate-100 hover:text-foreground"
            aria-label="Close reaction toast"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-foreground">
          {toast.starReaction.message}
        </p>
      </div>
    </div>
  </div>
);

export const ToastViewport = () => {
  const context = React.useContext(ToastContext);
  if (!context) {
    return null;
  }

  return (
    <div className="fixed right-4 top-4 z-[60] flex w-[min(24rem,calc(100vw-2rem))] max-w-[calc(100vw-2rem)] flex-col gap-2 sm:w-80">
      {context.toasts.map((toast) => (
        <div
          key={toast.id}
          className="animate-in slide-in-from-right-3 fade-in-0 duration-200"
        >
          {toast.kind === 'starReaction' && toast.starReaction ? (
            <StarReactionToastCard
              toast={toast as ToastPayload & { id: string; starReaction: StarReactionToastData }}
              onClose={() => context.remove(toast.id as string)}
            />
          ) : (
            <div
              className={cn(
                'rounded-xl border px-4 py-3 text-sm shadow-sm',
                variantStyles[toast.variant ?? 'info'],
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  {toast.title ? <p className="font-semibold">{toast.title}</p> : null}
                  {toast.description ? (
                    <p className="mt-1 text-xs text-muted-foreground">{toast.description}</p>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => context.remove(toast.id as string)}
                  className="shrink-0 rounded-full p-1 text-muted-foreground transition hover:bg-slate-100 hover:text-foreground"
                  aria-label="Close toast"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
};
