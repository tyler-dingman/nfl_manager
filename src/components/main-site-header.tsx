'use client';

import Link from 'next/link';
import { Search } from 'lucide-react';

import LoginButton from '@/components/auth/login-button';
import PrimaryNavigation from '@/components/primary-navigation';
import { SiteHeaderLogo, SiteHeaderShell } from '@/components/site-header-shell';
import type { PrimaryNavItemId } from '@/config/primary-navigation';
import NotificationCenter from '@/components/notifications/notification-center';
import MobileSiteMenu from '@/components/mobile-site-menu';

export default function MainSiteHeader({
  teamAbbr,
  active,
}: {
  teamAbbr?: string | null;
  active?: PrimaryNavItemId | null;
}) {
  const teamSuffix = teamAbbr ? `&team=${encodeURIComponent(teamAbbr)}` : '';

  return (
    <SiteHeaderShell>
      <SiteHeaderLogo teamAbbr={teamAbbr} generic={!teamAbbr} />
      <PrimaryNavigation teamAbbr={teamAbbr} active={active} showMobile={false} />
      <div className="ml-auto flex min-w-0 items-center gap-2">
        <Link
          href={`/?search=1${teamSuffix}`}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-current/20 text-[var(--team-on-dark)] transition hover:bg-white/10"
          aria-label="Search"
        >
          <Search className="h-4 w-4" />
        </Link>
        <NotificationCenter teamAbbr={teamAbbr} />
        <span className="hidden xl:block">
          <LoginButton teamAbbr={teamAbbr} />
        </span>
        <MobileSiteMenu teamAbbr={teamAbbr} active={active} />
      </div>
    </SiteHeaderShell>
  );
}
