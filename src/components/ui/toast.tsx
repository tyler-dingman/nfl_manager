'use client';

import * as React from 'react';
import {
  ArrowRightLeft,
  Eye,
  Heart,
  MessageCircle,
  Repeat2,
  Sparkles,
  TrendingUp,
  X,
} from 'lucide-react';

import { cn } from '@/lib/utils';

type ToastVariant = 'success' | 'error' | 'info';
type ToastKind = 'default' | 'starReaction' | 'leagueBuzz' | 'chainReaction' | 'progress';

type StarReactionToastData = {
  displayName: string;
  handle: string;
  subtitle: string;
  timestampLabel: string;
  message: string;
  headshotUrl?: string | null;
  likes: string;
  reposts: string;
  replies: string;
  views?: string;
};

type LeagueBuzzToastData = {
  displayName: string;
  subtitle: string;
  message: string;
  avatarUrl?: string | null;
  likes: string;
  reposts: string;
  comments: string;
};

type ChainReactionToastData = {
  title: string;
  subtitle?: string;
  effects: string[];
};

type ProgressToastData = {
  message: string;
  detail?: string;
};

export type ToastPayload = {
  id?: string;
  title?: string;
  description?: string;
  variant?: ToastVariant;
  kind?: ToastKind;
  durationMs?: number;
  starReaction?: StarReactionToastData;
  leagueBuzz?: LeagueBuzzToastData;
  chainReaction?: ChainReactionToastData;
  progress?: ProgressToastData;
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
      if (toast.kind === 'progress') {
        return;
      }
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
  <div className="rounded-[22px] border border-white/10 bg-black p-4 text-sm text-slate-100 shadow-[0_18px_45px_-18px_rgba(0,0,0,0.65)] backdrop-blur">
    <div className="flex items-start gap-3">
      {toast.starReaction.headshotUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={toast.starReaction.headshotUrl}
          alt={toast.starReaction.displayName}
          className="mt-0.5 h-11 w-11 shrink-0 rounded-full border border-white/10 object-cover"
        />
      ) : (
        <div className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-800 text-sm font-semibold text-slate-200">
          {toast.starReaction.displayName.charAt(0)}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
              <p className="truncate font-semibold text-slate-50">
                {toast.starReaction.displayName}
              </p>
              <span className="text-xs text-slate-400">{toast.starReaction.handle}</span>
              <span className="text-xs text-slate-500">•</span>
              <span className="text-xs text-slate-400">{toast.starReaction.timestampLabel}</span>
            </div>
            <p className="mt-0.5 text-xs text-slate-400">{toast.starReaction.subtitle}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-full p-1 text-slate-500 transition hover:bg-white/8 hover:text-slate-100"
            aria-label="Close reaction toast"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-3 whitespace-pre-wrap text-sm leading-5 text-slate-100">
          {toast.starReaction.message}
        </p>
        <div className="mt-3 flex items-center gap-4 text-xs text-slate-400">
          <span className="inline-flex items-center gap-1">
            <MessageCircle className="h-3.5 w-3.5" />
            {toast.starReaction.replies}
          </span>
          <span className="inline-flex items-center gap-1">
            <Repeat2 className="h-3.5 w-3.5" />
            {toast.starReaction.reposts}
          </span>
          <span className="inline-flex items-center gap-1">
            <Heart className="h-3.5 w-3.5" />
            {toast.starReaction.likes}
          </span>
          {toast.starReaction.views ? (
            <span className="inline-flex items-center gap-1">
              <Eye className="h-3.5 w-3.5" />
              {toast.starReaction.views}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  </div>
);

const LeagueBuzzToastCard = ({
  toast,
  onClose,
}: {
  toast: ToastPayload & { id: string; leagueBuzz: LeagueBuzzToastData };
  onClose: () => void;
}) => (
  <div className="rounded-2xl border border-white/10 bg-black p-4 text-sm text-slate-100 shadow-[0_18px_45px_-18px_rgba(0,0,0,0.65)]">
    <div className="flex items-start gap-3">
      {toast.leagueBuzz.avatarUrl ? (
        <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white ring-1 ring-white/10">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={toast.leagueBuzz.avatarUrl}
            alt={toast.leagueBuzz.displayName}
            className="h-full w-full scale-[0.86] object-cover object-top"
          />
        </div>
      ) : (
        <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#0a2a66] to-[#d50a0a] text-[11px] font-bold tracking-[0.18em] text-white">
          NFL
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate font-semibold text-slate-50">{toast.leagueBuzz.displayName}</p>
            <p className="mt-0.5 text-xs text-slate-400">{toast.leagueBuzz.subtitle}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-full p-1 text-slate-500 transition hover:bg-white/8 hover:text-slate-100"
            aria-label="Close league buzz toast"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-3 whitespace-pre-wrap text-sm leading-5 text-slate-100">
          {toast.leagueBuzz.message}
        </p>
        <div className="mt-3 flex items-center gap-4 text-xs text-slate-400">
          <span className="inline-flex items-center gap-1">
            <MessageCircle className="h-3.5 w-3.5" />
            {toast.leagueBuzz.comments}
          </span>
          <span className="inline-flex items-center gap-1">
            <Repeat2 className="h-3.5 w-3.5" />
            {toast.leagueBuzz.reposts}
          </span>
          <span className="inline-flex items-center gap-1">
            <Sparkles className="h-3.5 w-3.5" />
            {toast.leagueBuzz.likes}
          </span>
        </div>
      </div>
    </div>
  </div>
);

const ChainReactionToastCard = ({
  toast,
  onClose,
}: {
  toast: ToastPayload & { id: string; chainReaction: ChainReactionToastData };
  onClose: () => void;
}) => (
  <div className="rounded-2xl border border-border bg-white p-4 text-sm shadow-xl">
    <div className="flex items-start gap-3">
      <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-50 text-amber-700">
        <ArrowRightLeft className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate font-semibold text-foreground">{toast.chainReaction.title}</p>
            {toast.chainReaction.subtitle ? (
              <p className="mt-0.5 text-xs text-muted-foreground">{toast.chainReaction.subtitle}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-full p-1 text-muted-foreground transition hover:bg-slate-100 hover:text-foreground"
            aria-label="Close ripple effects toast"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-3 space-y-1.5">
          {toast.chainReaction.effects.map((effect) => (
            <p key={effect} className="text-sm leading-5 text-foreground">
              {effect}
            </p>
          ))}
        </div>
      </div>
    </div>
  </div>
);

const ProgressToastCard = ({
  toast,
  onClose,
}: {
  toast: ToastPayload & { id: string; progress: ProgressToastData };
  onClose: () => void;
}) => (
  <div className="rounded-2xl border border-emerald-200/80 bg-white p-4 text-sm shadow-xl">
    <div className="flex items-start gap-3">
      <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
        <TrendingUp className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-semibold text-foreground">+ Progress</p>
            {toast.progress.detail ? (
              <p className="mt-0.5 text-xs text-muted-foreground">{toast.progress.detail}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-full p-1 text-muted-foreground transition hover:bg-slate-100 hover:text-foreground"
            aria-label="Close progress toast"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-3 text-sm leading-6 text-foreground">{toast.progress.message}</p>
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
    <div className="fixed inset-x-3 top-3 z-[60] flex max-h-[calc(100dvh-1.5rem)] flex-col gap-2 overflow-hidden sm:inset-x-auto sm:right-4 sm:top-4 sm:w-[22rem]">
      {context.toasts.slice(-3).map((toast) => (
        <div key={toast.id} className="animate-in slide-in-from-right-3 fade-in-0 duration-200">
          {toast.kind === 'starReaction' && toast.starReaction ? (
            <StarReactionToastCard
              toast={toast as ToastPayload & { id: string; starReaction: StarReactionToastData }}
              onClose={() => context.remove(toast.id as string)}
            />
          ) : toast.kind === 'leagueBuzz' && toast.leagueBuzz ? (
            <LeagueBuzzToastCard
              toast={toast as ToastPayload & { id: string; leagueBuzz: LeagueBuzzToastData }}
              onClose={() => context.remove(toast.id as string)}
            />
          ) : toast.kind === 'chainReaction' && toast.chainReaction ? (
            <ChainReactionToastCard
              toast={toast as ToastPayload & { id: string; chainReaction: ChainReactionToastData }}
              onClose={() => context.remove(toast.id as string)}
            />
          ) : toast.kind === 'progress' && toast.progress ? (
            <ProgressToastCard
              toast={toast as ToastPayload & { id: string; progress: ProgressToastData }}
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
