'use client';

import { useState } from 'react';
import SiteSearchModal from '@/components/search/site-search-modal';
import { DdSearchIcon as Search } from '@/components/ui/football-icons';

import LoginButton from '@/components/auth/login-button';
import PrimaryNavigation from '@/components/primary-navigation';
import { SiteHeaderLogo, SiteHeaderShell } from '@/components/site-header-shell';
import type { PrimaryNavItemId } from '@/config/primary-navigation';
import NotificationCenter from '@/components/notifications/notification-center';
import MobileSiteMenu from '@/components/mobile-site-menu';

export default function MainSiteHeader({
  teamAbbr,
  active,
  tone = 'team',
}: {
  teamAbbr?: string | null;
  active?: PrimaryNavItemId | null;
  tone?: 'team' | 'merch' | 'brand';
}) {
  const [searchOpen, setSearchOpen] = useState(false);

  return (
    <SiteHeaderShell tone={tone}>
      <SiteSearchModal open={searchOpen} onClose={() => setSearchOpen(false)} teamAbbr={teamAbbr} />
      <SiteHeaderLogo teamAbbr={teamAbbr} generic={!teamAbbr} />
      <PrimaryNavigation
        teamAbbr={teamAbbr}
        active={active}
        tone={tone === 'brand' ? 'dark' : 'light'}
        showMobile={false}
      />
      <div className="ml-auto flex min-w-0 items-center gap-2">
        <button
          type="button"
          onClick={() => setSearchOpen(true)}
          aria-haspopup="dialog"
          className="flex h-10 w-10 items-center justify-center rounded-full border border-current/20 text-[var(--team-on-dark)] transition hover:bg-white/10"
          aria-label="Search"
        >
          <Search className="h-4 w-4" />
        </button>
        <NotificationCenter teamAbbr={teamAbbr} />
        <span className="hidden lg:block">
          <LoginButton teamAbbr={teamAbbr} />
        </span>
        <MobileSiteMenu teamAbbr={teamAbbr} active={active} />
      </div>
    </SiteHeaderShell>
  );
}
