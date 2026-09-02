'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Bell,
  Bookmark,
  BriefcaseBusiness,
  ChevronDown,
  LogIn,
  LogOut,
  Settings2,
  ShieldCheck,
  Trophy,
} from 'lucide-react';

import { clearPreviewSession, useAuthUser } from '@/features/auth/auth-session';
import UserAvatar from '@/components/auth/user-avatar';

export default function LoginButton({ dark = true }: { dark?: boolean }) {
  const router = useRouter();
  const { user, hydrated } = useAuthUser();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const className = dark
    ? 'border-current/20 bg-white/10 text-[var(--team-on-dark)] hover:bg-white/15'
    : 'border-[#00172B]/15 bg-white text-[#00172B] hover:bg-[#00172B]/5';

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  if (!hydrated || !user) {
    return (
      <Link
        href="/login"
        className={`flex h-10 items-center gap-2 rounded-full border px-3.5 text-sm font-black transition ${className}`}
        aria-label="Log in"
      >
        <LogIn className="h-4 w-4" />
        <span className="hidden sm:inline">Login</span>
      </Link>
    );
  }

  const links = [
    ['/account/my-team', 'My Team', Settings2],
    ['/rewards', 'Rewards', Trophy],
    ['/account/notifications', 'Notifications', Bell],
    ['/account/content', 'Content', Bookmark],
    ['/account', 'Account', BriefcaseBusiness],
    ['/account/devices', 'Devices', ShieldCheck],
    ['/account/privacy-security', 'Privacy & Security', ShieldCheck],
  ] as const;

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className={`flex h-10 items-center gap-2 rounded-full border px-3.5 text-sm font-black transition ${className}`}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <UserAvatar src={user.avatarUrl} name={user.name} />
        <span className="hidden sm:inline">{user.name.split(' ')[0]}</span>
        <ChevronDown className={`h-3.5 w-3.5 transition ${open ? 'rotate-180' : ''}`} />
      </button>
      {open ? (
        <div
          className="absolute right-0 top-12 z-[90] w-64 overflow-hidden rounded-2xl border border-slate-200 bg-white text-[#00172B] shadow-2xl"
          role="menu"
        >
          <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3">
            <UserAvatar
              src={user.avatarUrl}
              name={user.name}
              size="md"
              className="bg-slate-100 text-slate-500"
            />
            <div className="min-w-0">
              <p className="truncate text-sm font-black">{user.name}</p>
              <p className="truncate text-xs font-semibold text-slate-400">{user.email}</p>
            </div>
          </div>
          <div className="p-2">
            {links.map(([href, label, Icon]) => (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold hover:bg-[#f7f4ee]"
                role="menuitem"
              >
                <Icon className="h-4 w-4 text-[var(--team-primary-text)]" /> {label}
              </Link>
            ))}
          </div>
          <div className="border-t border-slate-100 p-2">
            <button
              type="button"
              onClick={async () => {
                await clearPreviewSession();
                setOpen(false);
                router.push('/');
              }}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-bold text-red-600 hover:bg-red-50"
              role="menuitem"
            >
              <LogOut className="h-4 w-4" /> Log out
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
