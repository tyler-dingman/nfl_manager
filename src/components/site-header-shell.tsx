import type { ReactNode } from 'react';

import { FiveWideLogo } from '@/components/branding/fivewide-logo';
import { cn } from '@/lib/utils';
import Link from 'next/link';

export function SiteHeaderShell({
  children,
  tone = 'team',
}: {
  children: ReactNode;
  tone?: 'team' | 'merch' | 'brand';
}) {
  return (
    <header
      data-site-header
      className={cn(
        'sticky top-0 z-[70] box-border border-b shadow-sm',
        tone === 'team'
          ? 'border-white/10 bg-[var(--dark)] text-[var(--team-on-dark)]'
          : tone === 'brand'
            ? 'border-white/20 bg-[#FF3D38] text-white [--team-light-on-dark:#fff] [--team-on-dark:#fff] [--team-secondary-on-dark:#fff]'
            : 'border-white/10 bg-[#00172B] text-white [--team-light-on-dark:#fff] [--team-on-dark:#fff] [--team-secondary-on-dark:#fff]',
      )}
    >
      <div className="mx-auto flex h-[var(--site-header-height)] max-w-[1440px] min-w-0 items-center gap-2 px-3 sm:gap-5 sm:px-6 lg:px-8">
        {children}
      </div>
    </header>
  );
}

export function SiteHeaderLogo({
  teamAbbr,
  generic = false,
}: {
  teamAbbr?: string | null;
  generic?: boolean;
}) {
  return (
    <Link
      href="/"
      className="flex h-full w-28 shrink-0 items-center sm:w-[var(--site-logo-width)]"
      aria-label="Down & Distance home"
    >
      <FiveWideLogo
        size={62}
        teamAbbr={teamAbbr}
        generic={generic}
        imageClassName="max-h-14 sm:max-h-[var(--site-logo-height)]"
        containerClassName="h-14 w-28 overflow-visible rounded-none border-0 bg-transparent p-0 shadow-none ring-0 sm:h-[var(--site-logo-height)] sm:w-[var(--site-logo-width)]"
        priority
      />
    </Link>
  );
}
