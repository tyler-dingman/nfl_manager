'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowLeftRight,
  ArrowRight,
  CalendarDays,
  Check,
  ChevronRight,
  FileText,
  Globe,
  HeartPulse,
  X,
} from 'lucide-react';
import { TEAM_LIST } from '@/data/teams';
import { apiFetch } from '@/lib/api';
import type { FrontOfficeEvent } from '@/types/front-office';
import type { PlayerRowDTO } from '@/types/player';
import { frontOfficeFont } from './front-office-font';
import styles from './front-office-weekly-brief.module.css';

const filters = ['All Updates', 'Team', 'League', 'Trade', 'Injury'] as const;
type Filter = (typeof filters)[number];
function category(event: FrontOfficeEvent, team: string): Filter {
  if (event.type.startsWith('trade_')) return 'Trade';
  if (/injury/i.test(String(event.metadata?.category ?? event.type))) return 'Injury';
  return event.teamAbbr === team || event.relatedTeamAbbr === team ? 'Team' : 'League';
}
function relativeTime(date: string) {
  const minutes = Math.max(0, Math.floor((Date.now() - Date.parse(date)) / 60000));
  if (!Number.isFinite(minutes)) return '';
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} min ago`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)} hr ago`;
  return `${Math.floor(minutes / 1440)} days ago`;
}
export function FrontOfficeWeeklyBrief({
  events,
  summary,
  player,
  teamAbbr,
  period,
  saveId,
  onRead,
  onClose,
}: {
  events: FrontOfficeEvent[];
  summary: string;
  player?: PlayerRowDTO;
  teamAbbr: string;
  period: string;
  saveId: string;
  onRead: (ids: string[]) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLElement>(null);
  const updates = useRef<HTMLDivElement>(null);
  const [bounds, setBounds] = useState<{ top: number; height: number } | null>(null);
  const [filter, setFilter] = useState<Filter>('All Updates');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [imageFailed, setImageFailed] = useState(false);
  const team = TEAM_LIST.find((t) => t.abbr === teamAbbr);
  const entries = events
    .filter((e) => !e.dismissedAt)
    .sort(
      (a, b) =>
        Number(Boolean(a.readAt)) - Number(Boolean(b.readAt)) ||
        Date.parse(b.createdAt) - Date.parse(a.createdAt),
    );
  const matching = (value: Filter) =>
    entries.filter((e) => value === 'All Updates' || category(e, teamAbbr) === value);
  useEffect(() => {
    const header = document.querySelector('[data-site-header]');
    const measure = () => {
      const zoom = Number.parseFloat(getComputedStyle(document.documentElement).zoom) || 1;
      const top = Math.max(0, header?.getBoundingClientRect().bottom ?? 0);
      setBounds({
        top: top / zoom,
        height: Math.max(0, (window.visualViewport?.height ?? window.innerHeight) - top) / zoom,
      });
    };
    measure();
    const observer = new ResizeObserver(measure);
    if (header) observer.observe(header);
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    window.visualViewport?.addEventListener('resize', measure);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
      window.visualViewport?.removeEventListener('resize', measure);
    };
  }, []);
  const ready = bounds !== null;
  useEffect(() => {
    if (!ready) return;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    ref.current?.querySelector<HTMLButtonElement>('button')?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key !== 'Tab') return;
      const nodes = Array.from(
        ref.current?.querySelectorAll<HTMLElement>('button:not(:disabled), a[href]') ?? [],
      ).filter((el) => el.getClientRects().length);
      const first = nodes[0],
        last = nodes[nodes.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener('keydown', key);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener('keydown', key);
      previous?.focus();
    };
    // Only establish focus once the measured overlay is mounted.
  }, [ready, onClose]);
  async function markRead(ids: string[], all = false) {
    setError('');
    setBusy(true);
    try {
      await apiFetch(
        all ? '/api/front-office/events' : `/api/front-office/events/${encodeURIComponent(ids[0])}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(all ? { saveId, action: 'read-all' } : { action: 'read' }),
        },
      );
      onRead(ids);
      window.dispatchEvent(new Event('front-office-events-read'));
    } catch {
      setError('Could not mark updates as read. Please try again.');
    } finally {
      setBusy(false);
    }
  }
  if (!bounds) return null;
  return (
    <div
      className={styles.backdrop}
      style={{ top: bounds.top, height: bounds.height }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby="weekly-brief-title"
        className={`${styles.panel} ${frontOfficeFont.variable}`}
      >
        <button className={styles.close} onClick={onClose} aria-label="Close weekly brief">
          <X />
        </button>
        <div className={styles.scroll}>
          <header className={styles.hero}>
            <div className={styles.geometry} />
            {team && (
              <Image
                className={styles.watermark}
                src={team.logoUrl}
                alt=""
                width={320}
                height={320}
                unoptimized
              />
            )}
            {player?.headshotUrl && !imageFailed && (
              <Image
                className={styles.player}
                src={player.headshotUrl}
                alt={`${player.firstName} ${player.lastName}`}
                width={600}
                height={600}
                unoptimized
                onError={() => setImageFailed(true)}
              />
            )}
            <div className={styles.copy}>
              <p className={styles.period}>
                <CalendarDays size={20} /> {period}
              </p>
              <h2 id="weekly-brief-title" className="front-office-feature-heading">
                Your Weekly
                <br />
                Front Office Brief
              </h2>
              <p className={styles.summary}>{summary}</p>
              <button
                className={styles.cta}
                onClick={() => {
                  updates.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  updates.current
                    ?.querySelector<HTMLButtonElement>('button')
                    ?.focus({ preventScroll: true });
                }}
              >
                Review Updates <ArrowRight size={20} />
              </button>
            </div>
            {player && (
              <div className={styles.identity}>
                <strong>
                  {player.firstName} {player.lastName}
                </strong>
                <span>{player.position}</span>
              </div>
            )}
          </header>
          <div className={styles.updates} ref={updates}>
            <div className={styles.toolbar}>
              <div className={styles.filters} aria-label="Filter weekly updates">
                {filters.map((value) => (
                  <button
                    key={value}
                    aria-pressed={filter === value}
                    onClick={() => setFilter(value)}
                  >
                    {value} ({matching(value).length})
                  </button>
                ))}
              </div>
              <button
                className={styles.markRead}
                disabled={busy || !entries.some((e) => !e.readAt)}
                onClick={() =>
                  void markRead(
                    entries.map((e) => e.id),
                    true,
                  )
                }
              >
                <Check size={18} /> {busy ? 'Saving…' : 'Mark All Read'}
              </button>
            </div>
            {error && (
              <p role="alert" className={styles.empty}>
                {error}
              </p>
            )}
            <div className={styles.rows}>
              {matching(filter)
                .slice(0, 6)
                .map((event) => {
                  const group = category(event, teamAbbr);
                  const logo = TEAM_LIST.find(
                    (t) => t.abbr === (event.relatedTeamAbbr ?? event.teamAbbr),
                  );
                  const Icon =
                    group === 'Trade'
                      ? ArrowLeftRight
                      : group === 'Injury'
                        ? HeartPulse
                        : group === 'League'
                          ? Globe
                          : FileText;
                  const href =
                    event.actionUrl?.startsWith('/') && !event.actionUrl.startsWith('//')
                      ? event.actionUrl
                      : '/front-office/league/news';
                  return (
                    <Link
                      key={event.id}
                      href={href}
                      className={styles.row}
                      data-unread={!event.readAt}
                      onClick={() => {
                        if (!event.readAt) void markRead([event.id]);
                      }}
                    >
                      <span className={styles.icon}>
                        {logo && group === 'Team' ? (
                          <Image
                            src={logo.logoUrl}
                            alt={logo.name}
                            width={38}
                            height={38}
                            unoptimized
                          />
                        ) : (
                          <Icon size={28} />
                        )}
                      </span>
                      <span className={styles.story}>
                        <strong>{event.headline}</strong>
                        <span>{event.summary}</span>
                      </span>
                      <time dateTime={event.createdAt}>{relativeTime(event.createdAt)}</time>
                      <ChevronRight size={20} />
                    </Link>
                  );
                })}
            </div>
            {!matching(filter).length && (
              <p className={styles.empty}>
                No {filter === 'All Updates' ? '' : `${filter.toLowerCase()} `}updates to show. New
                storylines appear as your franchise progresses.
              </p>
            )}
            <Link className={styles.viewAll} href="/front-office/league/news">
              View All Updates <ArrowRight size={18} />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
