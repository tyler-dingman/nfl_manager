'use client';

import Link from 'next/link';
import styles from './primary-navigation.module.css';
import MobileSiteMenu from '@/components/mobile-site-menu';
import { usePathname } from 'next/navigation';

import {
  getPrimaryNavActive,
  getPrimaryNavHref,
  PRIMARY_NAV_ITEMS,
  type PrimaryNavItemId,
} from '@/config/primary-navigation';

export default function PrimaryNavigation({
  teamAbbr,
  tone = 'light',
  showMobile = true,
}: {
  teamAbbr?: string | null;
  active?: PrimaryNavItemId | null;
  tone?: 'light' | 'dark';
  showMobile?: boolean;
}) {
  const pathname = usePathname();
  const activeItem = getPrimaryNavActive(pathname);
  const activeClass = tone === 'light' ? 'text-[var(--team-on-dark)]' : 'text-white';
  const inactiveClass =
    tone === 'light'
      ? 'text-[var(--team-light-on-dark)] hover:text-[var(--team-on-dark)]'
      : 'text-white/75 hover:text-white';

  return (
    <>
      <nav
        aria-label="Primary navigation"
        className="hidden items-center gap-6 text-sm font-semibold lg:flex"
      >
        {PRIMARY_NAV_ITEMS.map((item) => (
          <Link
            key={item.id}
            href={getPrimaryNavHref(item.href, teamAbbr)}
            aria-current={activeItem === item.id ? 'page' : undefined}
            data-nav-item={item.id}
            className={`${styles.link} ${activeItem === item.id ? activeClass : inactiveClass} whitespace-nowrap transition`}
          >
            {item.label}
          </Link>
        ))}
      </nav>
      {showMobile ? <MobileSiteMenu teamAbbr={teamAbbr} active={activeItem} /> : null}
    </>
  );
}
