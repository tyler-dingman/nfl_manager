import type { ReactNode } from 'react';

import { FiveWideLogo } from '@/components/branding/fivewide-logo';
import { cn } from '@/lib/utils';
import Link from 'next/link';

export function SiteHeaderShell({
  children,
  tone = 'team',
}: {
  children: ReactNode;
  tone?: 'team' | 'merch';
}) {
  return (
    <header
      className={cn(
        'sticky top-0 z-[70] box-border border-b shadow-sm',
        tone === 'team'
          ? 'border-white/10 bg-[var(--dark)] text-[var(--team-on-dark)]'
          : 'border-[#00172B]/10 bg-[#FF3D38] text-[#00172B]',
      )}
    >
      <div className="mx-auto flex h-[var(--site-header-height)] max-w-[1440px] items-center gap-5 px-4 sm:px-6 lg:px-8">
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
      className="flex h-full w-[var(--site-logo-width)] shrink-0 items-center"
      aria-label="Down & Distance home"
    >
      <FiveWideLogo
        size={62}
        teamAbbr={teamAbbr}
        generic={generic}
        imageClassName="max-h-[var(--site-logo-height)]"
        containerClassName="h-[var(--site-logo-height)] w-[var(--site-logo-width)] overflow-visible rounded-none border-0 bg-transparent p-0 shadow-none ring-0"
        priority
      />
    </Link>
  );
}
