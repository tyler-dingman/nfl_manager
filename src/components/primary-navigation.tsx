'use client';

import Link from 'next/link';
import { Menu, X } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

import {
  getPrimaryNavActive,
  getPrimaryNavHref,
  PRIMARY_NAV_ITEMS,
  type PrimaryNavItemId,
} from '@/config/primary-navigation';

export default function PrimaryNavigation({
  teamAbbr,
  active,
  tone = 'light',
}: {
  teamAbbr?: string | null;
  active?: PrimaryNavItemId | null;
  tone?: 'light' | 'dark';
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const activeItem = active === undefined ? getPrimaryNavActive(pathname) : active;
  const activeClass = tone === 'light' ? 'text-[var(--team-on-dark)]' : 'text-[#00172B]';
  const inactiveClass =
    tone === 'light'
      ? 'text-[var(--team-light-on-dark)] hover:text-[var(--team-on-dark)]'
      : 'text-[#00172B]/65 hover:text-[#00172B]';

  useEffect(() => setMobileOpen(false), [pathname]);

  return (
    <>
      <nav
        aria-label="Primary navigation"
        className="hidden items-center gap-6 text-sm font-semibold xl:flex"
      >
        {PRIMARY_NAV_ITEMS.map((item) => (
          <Link
            key={item.id}
            href={getPrimaryNavHref(item.href, teamAbbr)}
            aria-current={activeItem === item.id ? 'page' : undefined}
            className={`${activeItem === item.id ? activeClass : inactiveClass} whitespace-nowrap transition`}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border xl:hidden ${
          tone === 'light'
            ? 'border-white/15 text-[var(--light)] hover:bg-white/10'
            : 'border-[#00172B]/15 text-[#00172B] hover:bg-white/20'
        }`}
        aria-label="Open primary navigation"
        aria-expanded={mobileOpen}
      >
        <Menu className="h-5 w-5" />
      </button>

      {mobileOpen ? (
        <div className="fixed inset-0 z-[120] overflow-y-auto bg-[var(--dark)] px-5 py-6 text-[var(--team-on-dark)] xl:hidden">
          <div className="mx-auto max-w-lg">
            <div className="flex items-center justify-between border-b border-white/10 pb-5">
              <p className="text-xs font-black uppercase tracking-[0.22em] text-[var(--team-secondary-on-dark)]">
                Down &amp; Distance
              </p>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="flex h-11 w-11 items-center justify-center rounded-full border border-white/15 hover:bg-white/10"
                aria-label="Close primary navigation"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav aria-label="Mobile primary navigation" className="mt-5 grid">
              {PRIMARY_NAV_ITEMS.map((item) => (
                <Link
                  key={item.id}
                  href={getPrimaryNavHref(item.href, teamAbbr)}
                  aria-current={activeItem === item.id ? 'page' : undefined}
                  onClick={() => setMobileOpen(false)}
                  className={`border-b border-white/10 py-5 text-2xl font-black transition hover:pl-2 ${
                    activeItem === item.id
                      ? 'text-[var(--team-secondary-on-dark)]'
                      : 'text-[var(--team-on-dark)]'
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
        </div>
      ) : null}
    </>
  );
}
