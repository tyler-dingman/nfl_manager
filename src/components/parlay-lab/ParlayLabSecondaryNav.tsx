'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { FlaskConical } from 'lucide-react';
import styles from './parlay-lab-secondary-nav.module.css';

const links = [
  { href: '/parlay-lab/games', label: 'Games', section: 'games' },
  { href: '/parlay-lab/trends', label: 'Trends', section: 'trends' },
  {
    href: '/parlay-lab/lab-finds',
    label: 'Lab Finds',
    section: 'lab-finds',
    icon: FlaskConical,
  },
  { href: '/parlay-lab/my-plays', label: 'My Plays', section: 'my-plays' },
] as const;

export default function ParlayLabSecondaryNav() {
  const pathname = usePathname() ?? '/parlay-lab';
  const active = pathname.startsWith('/parlay-lab/my-plays')
    ? 'my-plays'
    : pathname.startsWith('/parlay-lab/lab-finds')
      ? 'lab-finds'
      : pathname.startsWith('/parlay-lab/trends')
        ? 'trends'
        : pathname.startsWith('/parlay-lab/games') || pathname.startsWith('/parlay-lab/game/')
          ? 'games'
          : null;

  return (
    <div className={styles.bar}>
      <nav className={styles.inner} aria-label="Parlay Lab">
        {links.map(({ href, label, section, ...link }) => (
          <Link
            key={section}
            href={href}
            aria-current={active === section ? 'page' : undefined}
            className={active === section ? styles.active : undefined}
          >
            {'icon' in link ? <link.icon aria-hidden="true" /> : null}
            {label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
