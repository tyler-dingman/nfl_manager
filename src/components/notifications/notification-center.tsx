'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Bell,
  CalendarDays,
  CircleAlert,
  Flame,
  Gamepad2,
  Newspaper,
  ShieldCheck,
  Trophy,
  Users,
  X,
} from 'lucide-react';

import { useAuthUser } from '@/features/auth/auth-session';

type InboxItem = {
  id: string;
  teamAbbr: string | null;
  category: string;
  title: string;
  body: string;
  deepLink: string | null;
  priority: string;
  createdAt: string;
  readAt: string | null;
};

const iconFor = (category: string) => {
  if (category === 'HOT_READ') return Flame;
  if (['INJURY', 'BREAKING'].includes(category)) return CircleAlert;
  if (['TRADE', 'SIGNING', 'RELEASE', 'ROSTER'].includes(category)) return Newspaper;
  if (['GAME_DAY', 'GAME_UPDATE'].includes(category)) return CalendarDays;
  if (category === 'TRIVIA') return Trophy;
  if (category === 'FRIENDS') return Users;
  if (category === 'FRONT_OFFICE') return ShieldCheck;
  if (category === 'CATCH_UP') return Gamepad2;
  return Bell;
};

const relativeTime = (value: string) => {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 60) return 'Now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
};

export default function NotificationCenter({ teamAbbr }: { teamAbbr?: string | null }) {
  const router = useRouter();
  const { user, hydrated } = useAuthUser();
  const rootRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [items, setItems] = useState<InboxItem[]>([]);
  const [count, setCount] = useState(0);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const refreshCount = useCallback(async () => {
    const response = await fetch('/api/user/notifications/unread-count', { cache: 'no-store' });
    if (response.ok) setCount(((await response.json()) as { count: number }).count);
  }, []);
  const load = useCallback(
    async (nextCursor?: string | null) => {
      setLoading(true);
      const params = new URLSearchParams({ limit: '20', filter });
      if (teamAbbr) params.set('team', teamAbbr);
      if (nextCursor) params.set('cursor', nextCursor);
      const response = await fetch(`/api/user/notifications?${params}`, { cache: 'no-store' });
      if (response.ok) {
        const body = (await response.json()) as {
          notifications: InboxItem[];
          nextCursor: string | null;
        };
        setItems((current) =>
          nextCursor ? [...current, ...body.notifications] : body.notifications,
        );
        setCursor(body.nextCursor);
      }
      setLoading(false);
    },
    [filter, teamAbbr],
  );

  useEffect(() => {
    if (!hydrated || !user) return;
    void refreshCount();
    const timer = window.setInterval(refreshCount, 30_000);
    return () => window.clearInterval(timer);
  }, [hydrated, refreshCount, user]);
  useEffect(() => {
    if (!open || !user) return;
    void load();
    void fetch('/api/user/notifications', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'seen' }),
    });
    window.setTimeout(() => closeRef.current?.focus(), 0);
  }, [load, open, user]);
  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent | MouseEvent) => {
      if (event instanceof KeyboardEvent && event.key === 'Escape') setOpen(false);
      if (event instanceof MouseEvent && !rootRef.current?.contains(event.target as Node))
        setOpen(false);
    };
    document.addEventListener('keydown', close);
    document.addEventListener('mousedown', close);
    return () => {
      document.removeEventListener('keydown', close);
      document.removeEventListener('mousedown', close);
    };
  }, [open]);

  const markAllRead = async () => {
    await fetch('/api/user/notifications', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'read-all' }),
    });
    setItems((current) => current.map((item) => ({ ...item, readAt: new Date().toISOString() })));
    setCount(0);
  };
  const openItem = async (item: InboxItem) => {
    if (!item.readAt) {
      await fetch('/api/user/notifications', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'read', notificationId: item.id }),
      });
      setCount((current) => Math.max(0, current - 1));
    }
    setOpen(false);
    router.push(item.deepLink || '/');
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => {
          if (hydrated && !user) router.push('/login?next=/');
          else setOpen((value) => !value);
        }}
        className="relative flex h-10 w-10 items-center justify-center rounded-full border border-current/20 text-[var(--team-on-dark)] transition hover:bg-white/10"
        aria-label={count ? `Notifications, ${count} unread` : 'Notifications'}
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <Bell className="h-4 w-4" />
        {count > 0 ? (
          <span className="absolute -right-1 -top-1 flex min-h-4 min-w-4 items-center justify-center rounded-full bg-[var(--team-secondary)] px-1 text-[9px] font-black leading-none text-[var(--team-on-secondary)] ring-2 ring-[var(--dark)]">
            {count > 9 ? '9+' : count}
          </span>
        ) : null}
      </button>
      {open ? (
        <>
          <div className="fixed inset-0 z-40 bg-black/30 sm:hidden" aria-hidden="true" />
          <section
            role="dialog"
            aria-modal="true"
            aria-label="Notification Center"
            className="fixed inset-x-3 top-16 z-50 flex max-h-[calc(100dvh-5rem)] flex-col overflow-hidden rounded-3xl bg-white text-[#00172B] shadow-2xl sm:absolute sm:inset-x-auto sm:right-0 sm:top-12 sm:h-auto sm:max-h-[min(680px,calc(100vh-7rem))] sm:w-[440px]"
          >
            <header className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <h2 className="text-sm font-black uppercase tracking-[0.18em]">Notifications</h2>
              <div className="flex items-center gap-2">
                {count ? (
                  <button
                    onClick={markAllRead}
                    className="text-xs font-bold text-[var(--team-primary-text)]"
                  >
                    Mark all read
                  </button>
                ) : null}
                <button
                  ref={closeRef}
                  onClick={() => setOpen(false)}
                  aria-label="Close notifications"
                  className="rounded-full p-2 hover:bg-slate-100"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </header>
            <div className="flex gap-2 border-b border-slate-200 px-5 py-3">
              {(['all', 'unread'] as const).map((value) => (
                <button
                  key={value}
                  onClick={() => setFilter(value)}
                  className={`rounded-full px-4 py-2 text-xs font-black uppercase tracking-wider ${filter === value ? 'team-primary-filled' : 'bg-slate-100 text-slate-600'}`}
                >
                  {value}
                </button>
              ))}
            </div>
            <div className="min-h-40 flex-1 overflow-y-auto" aria-live="polite">
              {!loading && !items.length ? (
                <div className="px-6 py-14 text-center">
                  <Bell className="mx-auto h-7 w-7 text-slate-300" />
                  <p className="mt-3 font-bold">You’re all caught up.</p>
                  <p className="mt-1 text-sm text-slate-500">New team updates will appear here.</p>
                </div>
              ) : null}
              {items.map((item) => {
                const Icon = iconFor(item.category);
                return (
                  <button
                    key={item.id}
                    onClick={() => openItem(item)}
                    className={`flex w-full gap-3 border-b border-slate-100 px-5 py-4 text-left transition hover:bg-slate-50 ${item.readAt ? 'bg-white' : 'bg-[var(--team-light)]/35'}`}
                    aria-label={`${item.readAt ? 'Read' : 'Unread'}: ${item.title}`}
                  >
                    <span className="team-primary-filled mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full">
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.16em] text-[var(--team-primary-text)]">
                        {item.category.replaceAll('_', ' ')}
                        {!item.readAt ? (
                          <span
                            className="h-2 w-2 rounded-full bg-[var(--team-secondary-text)]"
                            aria-hidden="true"
                          />
                        ) : null}
                      </span>
                      <span
                        className={`mt-1 block text-sm ${item.readAt ? 'font-bold' : 'font-black'}`}
                      >
                        {item.title}
                      </span>
                      {item.body ? (
                        <span className="mt-1 block text-xs leading-5 text-slate-500">
                          {item.body}
                        </span>
                      ) : null}
                      <span className="mt-2 block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        {relativeTime(item.createdAt)}
                      </span>
                    </span>
                  </button>
                );
              })}
              {cursor ? (
                <button
                  disabled={loading}
                  onClick={() => load(cursor)}
                  className="w-full px-5 py-4 text-xs font-black text-[var(--team-primary-text)] disabled:opacity-50"
                >
                  {loading ? 'Loading…' : 'Load more'}
                </button>
              ) : null}
            </div>
            {process.env.NODE_ENV !== 'production' ? (
              <button
                onClick={async () => {
                  await fetch('/api/user/notifications/dev-simulate', { method: 'POST' });
                  await load();
                  await refreshCount();
                }}
                className="border-t border-slate-200 px-5 py-3 text-xs font-bold text-slate-500 hover:bg-slate-50"
              >
                Add realistic test notifications
              </button>
            ) : null}
          </section>
        </>
      ) : null}
    </div>
  );
}
