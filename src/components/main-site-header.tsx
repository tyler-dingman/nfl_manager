'use client';

import Link from 'next/link';
import { Menu, Search, Shield } from 'lucide-react';

import LoginButton from '@/components/auth/login-button';
import PrimaryNavigation from '@/components/primary-navigation';
import { SiteHeaderLogo, SiteHeaderShell } from '@/components/site-header-shell';
import type { PrimaryNavItemId } from '@/config/primary-navigation';
import { useTeamStore } from '@/features/team/team-store';
import NotificationCenter from '@/components/notifications/notification-center';
import MobileSiteMenu from '@/components/mobile-site-menu';

export default function MainSiteHeader({
  teamAbbr,
  active,
}: {
  teamAbbr?: string | null;
  active?: PrimaryNavItemId | null;
}) {
  const team = useTeamStore((state) =>
    state.teams.find((candidate) => candidate.abbr === teamAbbr),
  );
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
        <Link
          href={`/?team-select=1${teamSuffix}`}
          className="hidden h-10 items-center gap-2 rounded-full border border-white/15 bg-white/10 px-2.5 pr-4 text-sm font-bold leading-none transition hover:bg-white/15 xl:flex"
          aria-label="Return to site and change team"
        >
          {team?.logo_url ? (
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={team.logo_url} alt="" className="h-6 w-6 object-contain" />
            </span>
          ) : (
            <Shield className="h-5 w-5 text-[var(--team-secondary-on-dark)]" />
          )}
          <span className="hidden sm:inline">
            {teamAbbr ? `${teamAbbr} · Team Select` : 'Team Select'}
          </span>
          <Menu className="h-4 w-4" />
        </Link>
        <span className="hidden xl:block">
          <LoginButton />
        </span>
        <MobileSiteMenu teamAbbr={teamAbbr} active={active} />
      </div>
    </SiteHeaderShell>
  );
}
