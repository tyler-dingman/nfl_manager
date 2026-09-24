'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { BriefcaseBusiness, ShieldCheck, Trophy, Users, Shield } from 'lucide-react';
import {
  DdNotificationsIcon as Bell,
  DdSaveIcon as Bookmark,
} from '@/components/ui/football-icons';
import { useAuthUser } from '@/features/auth/auth-session';

export const profileLinks = [
  ['/account', 'Account', BriefcaseBusiness],
  ['/rewards', 'Rewards', Trophy],
  ['/crew', 'My Crew', Users],
  ['/account/my-team', 'Favorite Team', Shield],
  ['/account/notifications', 'Notifications', Bell],
  ['/account/content', 'Content', Bookmark],
  ['/account/devices', 'Devices', ShieldCheck],
  ['/account/privacy-security', 'Privacy & Security', ShieldCheck],
] as const;

const aliases: Record<string, string> = {
  '/account/account': '/account',
  '/account/preferences': '/account/my-team',
  '/account/saved': '/account/content',
  '/account/front-office': '/account/content',
  '/account/security': '/account/privacy-security',
};

export default function ProfileLayout({ children }: { children: ReactNode }) {
  const { user } = useAuthUser();
  const pathname = usePathname() ?? '';
  const activePath = aliases[pathname] ?? pathname;
  return (
    <main className="mx-auto grid max-w-6xl gap-6 px-4 py-10 sm:px-6 lg:grid-cols-[250px_minmax(0,1fr)]">
      <aside className="h-fit min-w-0 rounded-3xl bg-[var(--dark)] p-3 text-[var(--team-on-dark)] lg:sticky lg:top-28">
        {user ? (
          <div className="px-3 py-4">
            <p className="break-words font-black">{user.name}</p>
            <p className="mt-1 truncate text-xs font-semibold text-[var(--team-light-on-dark)]">
              {user.email}
            </p>
          </div>
        ) : null}
        <nav aria-label="Profile" className="grid gap-1 sm:grid-cols-3 lg:grid-cols-1">
          {profileLinks.map(([href, label, Icon]) => (
            <Link
              key={href}
              href={href}
              aria-current={activePath === href ? 'page' : undefined}
              className={`flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-bold ${activePath === href ? 'team-primary-filled' : 'text-[var(--team-light-on-dark)] hover:bg-white/10 hover:text-[var(--team-on-dark)]'}`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </Link>
          ))}
        </nav>
      </aside>
      <div className="min-w-0 [container-type:inline-size] [container-name:profile-content]">
        {children}
      </div>
    </main>
  );
}
