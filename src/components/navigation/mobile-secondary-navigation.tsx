'use client';
import { useEffect, useState, type ComponentType } from 'react';
import Link from 'next/link';
import { Check, ChevronDown } from 'lucide-react';
import { DdMenuIcon } from '@/components/ui/football-icons';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import styles from './mobile-secondary-navigation.module.css';

export type SecondaryNavigationItem = {
  label: string;
  href: string;
  icon?: ComponentType<{ className?: string; 'aria-hidden'?: boolean | 'true' | 'false' }>;
  active?: boolean;
};

/** Use the same items for this mobile bar and the section's desktop navigation. */
export function MobileSecondaryNavigation({
  label,
  items,
  currentRoute,
  breakpoint = 1024,
  tone = 'default',
}: {
  label: string;
  items: readonly SecondaryNavigationItem[];
  currentRoute: string;
  breakpoint?: 768 | 1024 | 1100;
  tone?: 'default' | 'merch';
}) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    setOpen(false);
  }, [currentRoute]);
  useEffect(() => {
    const media = window.matchMedia(`(min-width: ${breakpoint}px)`);
    const close = () => {
      if (media.matches) setOpen(false);
    };
    media.addEventListener('change', close);
    return () => media.removeEventListener('change', close);
  }, [breakpoint]);
  return (
    <div className={`${styles.bar} ${styles[`below${breakpoint}`]}`} data-tone={tone}>
      <button
        type="button"
        className={styles.trigger}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <DdMenuIcon aria-hidden="true" />
        <span>{label}</span>
        <ChevronDown aria-hidden="true" className={open ? styles.open : ''} />
      </button>
      {open && (
        <BottomSheet
          title={label}
          closeLabel="Close section navigation"
          onClose={() => setOpen(false)}
        >
          <nav aria-label={label} className={styles.destinations}>
            {items.map(({ label: text, href, icon: Icon, active }) => (
              <Link
                key={text}
                href={href}
                aria-current={(active ?? currentRoute === href) ? 'page' : undefined}
                onClick={() => setOpen(false)}
              >
                {Icon && <Icon aria-hidden={true} />}
                <span>{text}</span>
                {(active ?? currentRoute === href) && <Check aria-hidden="true" />}
              </Link>
            ))}
          </nav>
        </BottomSheet>
      )}
    </div>
  );
}
