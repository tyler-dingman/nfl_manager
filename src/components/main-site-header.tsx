'use client';

import Link from 'next/link';
import { Menu, Shield } from 'lucide-react';

import LoginButton from '@/components/auth/login-button';
import PrimaryNavigation from '@/components/primary-navigation';
import { SiteHeaderLogo, SiteHeaderShell } from '@/components/site-header-shell';
import type { PrimaryNavItemId } from '@/config/primary-navigation';

export default function MainSiteHeader({
  teamAbbr,
  active,
}: {
  teamAbbr?: string | null;
  active?: PrimaryNavItemId | null;
}) {
  return (
    <SiteHeaderShell>
      <SiteHeaderLogo teamAbbr={teamAbbr} generic={!teamAbbr} />
      <PrimaryNavigation teamAbbr={teamAbbr} active={active} />
      <div className="ml-auto flex items-center gap-2">
        <Link
          href="/"
          className="flex h-10 items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3.5 text-sm font-bold leading-none transition hover:bg-white/15"
          aria-label="Return to site and change team"
        >
          <Shield className="h-5 w-5 text-[var(--team-secondary-on-dark)]" />
          <span className="hidden sm:inline">
            {teamAbbr ? `${teamAbbr} · Team Select` : 'Team Select'}
          </span>
          <Menu className="h-4 w-4" />
        </Link>
        <LoginButton />
      </div>
    </SiteHeaderShell>
  );
}
