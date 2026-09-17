'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useRef } from 'react';
import {
  FRONT_OFFICE_NAVIGATION,
  isFrontOfficeRouteActive,
  type FrontOfficeSection,
} from '@/lib/front-office-navigation';
import styles from './front-office-section-nav.module.css';

export function FrontOfficeSectionNav({ section }: { section: FrontOfficeSection }) {
  const pathname = usePathname() ?? '';
  const params = useSearchParams();
  const activeRef = useRef<HTMLAnchorElement>(null);
  const items = FRONT_OFFICE_NAVIGATION[section];

  useEffect(() => {
    activeRef.current?.scrollIntoView({ behavior: 'instant', block: 'nearest', inline: 'center' });
  }, [pathname, params]);

  return (
    <nav className={styles.nav} aria-label={`${section} navigation`}>
      {items.map((item) => {
        const itemPath = item.href.split('?')[0];
        const sectionRoot = FRONT_OFFICE_NAVIGATION[section][0].href.split('?')[0];
        const active =
          isFrontOfficeRouteActive(item.href, pathname, params ?? new URLSearchParams()) ||
          (itemPath !== sectionRoot && pathname.startsWith(`${itemPath}/`)) ||
          (section === 'roster' &&
            item.key === 'trade-hub' &&
            pathname.startsWith('/front-office/trade-hub/') &&
            pathname !== '/front-office/trade-hub');
        return (
          <Link
            key={item.key}
            ref={active ? activeRef : undefined}
            href={item.href}
            aria-current={active ? 'page' : undefined}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
