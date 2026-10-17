'use client';
import Link from 'next/link';
import { ChevronDown } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { getPrimaryNavHref } from '@/config/primary-navigation';
import styles from './primary-navigation.module.css';

export function PrimaryNavGroup({
  label,
  items,
  active,
  teamAbbr,
  mobile = false,
  className = '',
  onNavigate,
}: {
  label: string;
  items: readonly { id: string; label: string; href: string }[];
  active: boolean;
  teamAbbr?: string | null;
  mobile?: boolean;
  className?: string;
  onNavigate?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const id = useId(),
    pathname = usePathname();
  const root = useRef<HTMLDivElement>(null),
    trigger = useRef<HTMLButtonElement>(null);
  const restoring = useRef(false);
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [open]);
  const links = () => Array.from(root.current?.querySelectorAll<HTMLAnchorElement>('a') ?? []);
  return (
    <div
      ref={root}
      className={mobile ? styles.mobileGroup : styles.group}
      onMouseEnter={() => {
        if (!mobile) setOpen(true);
      }}
      onMouseLeave={() => {
        if (!mobile && !root.current?.contains(document.activeElement)) setOpen(false);
      }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && open) {
          event.preventDefault();
          event.stopPropagation();
          restoring.current = true;
          trigger.current?.focus();
          setOpen(false);
          restoring.current = false;
        } else if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
          event.preventDefault();
          setOpen(true);
          requestAnimationFrame(() => {
            const options = links(),
              index = options.indexOf(document.activeElement as HTMLAnchorElement);
            const next =
              event.key === 'Home'
                ? 0
                : event.key === 'End' || (index < 0 && event.key === 'ArrowUp')
                  ? options.length - 1
                  : (index + (event.key === 'ArrowUp' ? -1 : 1) + options.length) % options.length;
            options[next]?.focus();
          });
        }
      }}
    >
      <button
        ref={trigger}
        type="button"
        className={`${styles.link} ${styles.trigger} ${className}`}
        aria-expanded={open}
        aria-controls={id}
        aria-current={active ? 'page' : undefined}
        data-nav-item="play"
        onFocus={() => {
          if (!mobile && !restoring.current) setOpen(true);
        }}
        onClick={() => setOpen(mobile ? !open : true)}
      >
        {label}
        <ChevronDown size={14} aria-hidden="true" className={open ? styles.rotated : undefined} />
      </button>
      {open && (
        <div id={id} className={mobile ? styles.mobileSubmenu : styles.submenu}>
          {items.map((item) => (
            <Link
              key={item.id}
              href={getPrimaryNavHref(item.href, teamAbbr)}
              aria-current={
                pathname === item.href || pathname?.startsWith(`${item.href}/`) ? 'page' : undefined
              }
              onClick={() => {
                setOpen(false);
                onNavigate?.();
              }}
            >
              {item.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
