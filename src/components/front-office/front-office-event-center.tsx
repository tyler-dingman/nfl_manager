'use client';

import Image from 'next/image';
import { useTeamStyle } from '@/components/team-theme-provider';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowLeftRight, ChevronRight, X } from 'lucide-react';
import { DdLiveIcon as Radio } from '@/components/ui/football-icons';
import { DdNotificationsIcon as Bell } from '@/components/ui/football-icons';
import { createPortal } from 'react-dom';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { TEAM_LIST } from '@/data/teams';
import { apiFetch } from '@/lib/api';
import { frontOfficeEventIncludesTeam, relativeNewsTime } from '@/lib/front-office-league-news';
import type { FrontOfficeEvent } from '@/types/front-office';

import {
  useDraftTradeNotifications,
  unreadDraftOffers,
} from '@/features/draft/trade-notifications';
import { presentMockOffer } from '@/lib/mock-trade-presentation';
import { FrontOfficeNotificationToast } from './front-office-notification-toast';

type NewsFilter = 'all' | 'team' | 'breaking';

const categoryFromText = (event: FrontOfficeEvent) => {
  const text =
    `${event.headline} ${event.summary} ${String(event.metadata.topic ?? '')}`.toLowerCase();
  if (/injur|questionable|doubtful|ruled out|availability/.test(text)) return 'INJURY';
  if (/coach|coordinator|play-caller|fired|hired/.test(text)) return 'COACHING';
  if (/draft|prospect|pick\b|combine/.test(text)) return 'DRAFT';
  if (/contract|extension|re-sign|salary|cap hit/.test(text)) return 'CONTRACT';
  if (/trade|acquire|deal\b/.test(text)) return 'TRADE';
  if (/signing|signs\b|signed\b/.test(text)) return 'SIGNING';
  if (/release|released|waiv|cut\b/.test(text)) return 'RELEASE';
  if (/roster|depth chart|starter|practice squad/.test(text)) return 'ROSTER';
  if (/week \d+|matchup|game\b|victory|defeat/.test(text)) return 'GAME';
  return null;
};

const categoryFor = (event: FrontOfficeEvent) => {
  const explicit = String(event.metadata.newsCategory ?? '').toUpperCase();
  if (explicit === 'GAME_RECAP') return 'GAME';
  if (explicit === 'TRANSACTION') return 'ROSTER';
  if (
    [
      'BREAKING',
      'TRADE',
      'INJURY',
      'SIGNING',
      'RELEASE',
      'CONTRACT',
      'RUMOR',
      'GAME',
      'DRAFT',
      'ROSTER',
      'COACHING',
    ].includes(explicit)
  )
    return explicit;
  if (event.type === 'breaking_news' || event.type === 'deadline_alert') return 'BREAKING';
  if (['trade_rumor', 'trade_interest', 'trade_offer'].includes(event.type))
    return event.type === 'trade_rumor' ? 'RUMOR' : 'TRADE';
  if (event.type === 'free_agent_signing') return 'SIGNING';
  if (event.type === 'player_release') return 'RELEASE';
  if (['contract_extension', 're_sign_ready'].includes(event.type)) return 'CONTRACT';
  if (event.type === 'draft_buzz') return 'DRAFT';
  if (event.type === 'league_transaction') return 'ROSTER';
  return categoryFromText(event) ?? 'ROSTER';
};

const isBreaking = (event: FrontOfficeEvent) =>
  event.type === 'breaking_news' ||
  String(event.metadata.newsCategory ?? '').toUpperCase() === 'BREAKING' ||
  (event.priority === 'urgent' && Number(event.metadata.importanceScore ?? 0) >= 90);

const isNewsEvent = (event: FrontOfficeEvent) =>
  event.type !== 'welcome_message' &&
  String(event.metadata.channel ?? '').toUpperCase() !== 'MESSAGE';

const teamFor = (event: FrontOfficeEvent) =>
  TEAM_LIST.find((team) => team.abbr === (event.teamAbbr ?? event.relatedTeamAbbr));

function NotificationTeamLogo({
  primaryAbbr,
  secondaryAbbr,
}: {
  primaryAbbr?: string;
  secondaryAbbr?: string;
}) {
  const primary = TEAM_LIST.find((team) => team.abbr === primaryAbbr);
  const secondary = TEAM_LIST.find(
    (team) => team.abbr === secondaryAbbr && team.abbr !== primary?.abbr,
  );
  return (
    <span className={`fo-news-team-logo${secondary ? ' multi-team' : ''}`}>
      {primary ? (
        <Image src={primary.logoUrl} alt={primary.name} width={36} height={36} unoptimized />
      ) : (
        <Bell aria-hidden="true" />
      )}
      {secondary && (
        <Image
          className="fo-news-secondary-logo"
          src={secondary.logoUrl}
          alt={secondary.name}
          width={22}
          height={22}
          unoptimized
        />
      )}
    </span>
  );
}
function EventTeamLogo({ event }: { event: FrontOfficeEvent }) {
  return (
    <NotificationTeamLogo
      primaryAbbr={teamFor(event)?.abbr}
      secondaryAbbr={event.relatedTeamAbbr ?? undefined}
    />
  );
}

export function FrontOfficeEventCenter({
  saveId,
  teamAbbr,
  paused = false,
}: {
  saveId: string;
  teamAbbr: string;
  paused?: boolean;
}) {
  const teamStyle = useTeamStyle();
  const pathname = usePathname();
  const [events, setEvents] = useState<FrontOfficeEvent[]>([]);
  const [notification, setNotification] = useState<FrontOfficeEvent | null>(null);
  const [tradeFilter, setTradeFilter] = useState<'all' | 'new' | 'resolved'>('all');
  const [newsOpen, setNewsOpen] = useState(false);
  const draft = useDraftTradeNotifications();
  const draftActive = Boolean(draft.session);
  const open = draftActive ? draft.drawerOpen : newsOpen;
  const setOpen = useCallback((value: boolean) => {
    if (useDraftTradeNotifications.getState().session)
      useDraftTradeNotifications.setState({ drawerOpen: value });
    else setNewsOpen(value);
  }, []);
  const tradeEntries = draft.session
    ? (draft.session.tradeState?.offers ?? []).map((offer) =>
        presentMockOffer(draft.session!, offer),
      )
    : [];
  const unreadTrades = tradeEntries.filter(
    (entry) => entry.valid && !draft.readIds.includes(entry.offer.id),
  );
  const resolvedTrades = tradeEntries.filter((entry) => !entry.valid);
  const visibleTrades =
    tradeFilter === 'new'
      ? unreadTrades
      : tradeFilter === 'resolved'
        ? resolvedTrades
        : tradeEntries;
  const tradeTime = (id: string, pick: number) =>
    draft.receivedAt[id] ? relativeNewsTime(draft.receivedAt[id]) : `Pick ${pick + 1}`;
  const toastOffer = tradeEntries.find((entry) => entry.offer.id === draft.toastId && entry.valid);
  useEffect(() => {
    setNewsOpen(false);
    setNotification(null);
    setTradeFilter('all');
  }, [draftActive]);
  useEffect(() => {
    if (!draft.toastId) return;
    const timer = setTimeout(() => useDraftTradeNotifications.setState({ toastId: null }), 6500);
    return () => clearTimeout(timer);
  }, [draft.toastId]);
  const [filter, setFilter] = useState<NewsFilter>('all');
  const [mounted, setMounted] = useState(false);
  const [focusedStoryId, setFocusedStoryId] = useState<string | null>(null);
  const [visibleLimit, setVisibleLimit] = useState(60);
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const storyRefs = useRef<Record<string, HTMLAnchorElement | null>>({});
  const storageKey = `fo-news-notifications:${saveId}`;

  const load = useCallback(async () => {
    const response = await apiFetch(
      `/api/front-office/events?saveId=${encodeURIComponent(saveId)}`,
    );
    if (!response.ok) return;
    const payload = (await response.json()) as { events: FrontOfficeEvent[] };
    setEvents(payload.events);
  }, [saveId]);

  const surface = useCallback(async () => {
    const response = await apiFetch('/api/front-office/events/next', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ saveId, teamAbbr }),
    });
    if (!response.ok) return false;
    const payload = (await response.json()) as { event: FrontOfficeEvent | null };
    if (!payload.event) return false;
    setNotification(payload.event);
    await load();
    return true;
  }, [load, saveId, teamAbbr]);

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!mounted || paused || open || !pathname || draftActive) return;
    const state = JSON.parse(sessionStorage.getItem(storageKey) ?? '{}') as {
      count?: number;
      lastPath?: string;
    };
    if (state.lastPath === pathname) return;
    const next = { count: (state.count ?? 0) + 1, lastPath: pathname };
    sessionStorage.setItem(storageKey, JSON.stringify(next));
    if (next.count < 5) return;
    void surface().then((didSurface) => {
      if (didSurface)
        sessionStorage.setItem(storageKey, JSON.stringify({ count: 0, lastPath: pathname }));
    });
  }, [mounted, open, pathname, paused, storageKey, surface, draftActive]);

  useEffect(() => {
    const onAdvanced = () => void load();
    window.addEventListener('front-office-simulation-advanced', onAdvanced);
    window.addEventListener('front-office-events-read', onAdvanced);
    return () => {
      window.removeEventListener('front-office-simulation-advanced', onAdvanced);
      window.removeEventListener('front-office-events-read', onAdvanced);
    };
  }, [load]);

  useEffect(() => {
    if (!notification || open) return;
    const timer = window.setTimeout(() => setNotification(null), 6500);
    return () => window.clearTimeout(timer);
  }, [notification, open]);

  const closeDrawer = useCallback(() => {
    setOpen(false);
    setFocusedStoryId(null);
    window.setTimeout(() => {
      if (useDraftTradeNotifications.getState().session)
        document.querySelector<HTMLElement>('[data-notification-bell]')?.focus();
      else triggerRef.current?.focus();
    }, 0);
  }, [setOpen]);

  const openDrawer = useCallback(
    (storyId?: string) => {
      setNotification(null);
      setFocusedStoryId(storyId ?? null);
      setOpen(true);
    },
    [setOpen],
  );

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const focusTimer = window.setTimeout(() => {
      if (focusedStoryId && storyRefs.current[focusedStoryId])
        storyRefs.current[focusedStoryId]?.focus();
      else closeRef.current?.focus();
    }, 0);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') return closeDrawer();
      if (event.key !== 'Tab' || !panelRef.current) return;
      const focusable = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"]):not([disabled])',
        ),
      );
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [closeDrawer, focusedStoryId, open]);

  const update = useCallback(
    async (event: FrontOfficeEvent, action: 'read' | 'dismiss') => {
      await apiFetch(`/api/front-office/events/${encodeURIComponent(event.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      await load();
    },
    [load],
  );

  const newsEvents = useMemo(() => events.filter(isNewsEvent), [events]);
  const unread = newsEvents.filter((event) => !event.readAt).length;
  const myTeamEvents = useMemo(
    () => newsEvents.filter((event) => frontOfficeEventIncludesTeam(event, teamAbbr)),
    [newsEvents, teamAbbr],
  );
  const breakingEvents = useMemo(() => newsEvents.filter(isBreaking), [newsEvents]);
  const visibleEvents =
    filter === 'team' ? myTeamEvents : filter === 'breaking' ? breakingEvents : newsEvents;

  useEffect(() => setVisibleLimit(60), [filter]);

  const markAllRead = async () => {
    await apiFetch('/api/front-office/events', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ saveId, action: 'read-all' }),
    });
    await load();
  };

  const drawer = open ? (
    <div
      className="front-office-app fo-wire-backdrop"
      style={teamStyle}
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && closeDrawer()}
    >
      <div
        ref={panelRef}
        className="fo-wire-panel"
        data-mode={draftActive ? 'draft-trades' : 'news'}
        role="dialog"
        aria-modal="true"
        aria-labelledby="fo-news-title"
      >
        <header>
          <h2 id="fo-news-title">
            {draftActive ? <ArrowLeftRight aria-hidden="true" /> : <Radio aria-hidden="true" />}{' '}
            {draftActive ? 'Draft Trade Hub' : 'News'}
          </h2>
          <button
            ref={closeRef}
            type="button"
            onClick={closeDrawer}
            aria-label={draftActive ? 'Close trade notifications' : 'Close news'}
          >
            <X />
          </button>
        </header>
        {draftActive ? (
          <>
            <div className="fo-news-filters" role="tablist" aria-label="Trade notification filters">
              {(
                [
                  ['all', 'All', tradeEntries.length],
                  ['new', 'New', unreadTrades.length],
                  ['resolved', 'Resolved', resolvedTrades.length],
                ] as const
              ).map(([value, label, count]) => (
                <button
                  key={value}
                  type="button"
                  role="tab"
                  aria-selected={tradeFilter === value}
                  onClick={() => setTradeFilter(value)}
                >
                  {label} <span>{count}</span>
                </button>
              ))}
            </div>
            <div className="fo-wire-list">
              {!visibleTrades.length && (
                <p className="fo-wire-empty">
                  {tradeFilter === 'new'
                    ? 'No unread trade offers.'
                    : tradeFilter === 'resolved'
                      ? 'No resolved trade offers.'
                      : 'No trade offers yet.'}
                </p>
              )}
              {[...visibleTrades].reverse().map((entry) => {
                const offer = entry.offer;
                const unread = entry.valid && !draft.readIds.includes(offer.id);
                const team = TEAM_LIST.find((t) => t.abbr === offer.team);
                const status = entry.valid ? 'TRADE_OFFER' : entry.status.toUpperCase();
                const target = entry.send.find((p) => p.overallSlot);
                return (
                  <button
                    type="button"
                    className={`fo-news-row ${unread ? 'unread' : 'read'}`}
                    data-active={entry.valid}
                    key={offer.id}
                    disabled={!entry.valid}
                    onClick={() => draft.view(offer.id)}
                    aria-label={`${entry.valid ? 'View Offer: ' : ''}${team?.name ?? offer.team}, ${status.replaceAll('_', ' ')}`}
                  >
                    <NotificationTeamLogo primaryAbbr={offer.team} />
                    <span className="fo-news-row-copy">
                      <span className="fo-news-meta">
                        <b data-category={status}>{status.replaceAll('_', ' ')}</b>
                        <time>{tradeTime(offer.id, offer.createdPick)}</time>
                      </span>
                      <strong>
                        {team?.city ?? offer.team} wants to{' '}
                        {offer.intent === 'move_up' ? 'trade up' : 'move back'}
                      </strong>
                      <small>
                        {target
                          ? `Targeting Round ${target.round} · Pick ${target.overallSlot}`
                          : 'Trading for future draft capital'}{' '}
                        · {entry.value.label}
                      </small>
                    </span>
                    <ChevronRight aria-hidden="true" />
                  </button>
                );
              })}
            </div>
          </>
        ) : (
          <>
            <div className="fo-news-filters" role="tablist" aria-label="News filters">
              {(
                [
                  ['all', 'All', newsEvents.length],
                  ['team', 'My Team', myTeamEvents.length],
                  ['breaking', 'Breaking', breakingEvents.length],
                ] as const
              ).map(([value, label, count]) => (
                <button
                  key={value}
                  type="button"
                  role="tab"
                  aria-selected={filter === value}
                  onClick={() => setFilter(value)}
                >
                  {label} <span>{count}</span>
                </button>
              ))}
            </div>
            <div className="fo-wire-list">
              {visibleEvents.length ? (
                visibleEvents.slice(0, visibleLimit).map((event) => {
                  const category = categoryFor(event);
                  return (
                    <Link
                      key={event.id}
                      ref={(node) => {
                        storyRefs.current[event.id] = node;
                      }}
                      href={`/front-office/league/news/${encodeURIComponent(event.id)}`}
                      className={`fo-news-row${event.readAt ? ' read' : ' unread'}${focusedStoryId === event.id ? ' focused-story' : ''}`}
                      onClick={() => {
                        void update(event, 'read');
                        closeDrawer();
                      }}
                    >
                      <EventTeamLogo event={event} />
                      <span className="fo-news-row-copy">
                        <span className="fo-news-meta">
                          <b data-category={category}>{category}</b>
                          <time>
                            {relativeNewsTime(
                              String(event.metadata.sourcePublishedAt ?? event.createdAt),
                            )}
                          </time>
                        </span>
                        <strong>{event.headline}</strong>
                      </span>
                      <ChevronRight aria-hidden="true" />
                    </Link>
                  );
                })
              ) : (
                <p className="fo-wire-empty">No news matches this filter.</p>
              )}
              {visibleEvents.length > visibleLimit ? (
                <button
                  className="fo-news-load-more"
                  type="button"
                  onClick={() => setVisibleLimit((limit) => limit + 60)}
                >
                  Load more news
                </button>
              ) : null}
            </div>
          </>
        )}
        <footer>
          <button
            type="button"
            onClick={() =>
              draftActive
                ? draft.markRead(tradeEntries.filter((e) => e.valid).map((e) => e.offer.id))
                : void markAllRead()
            }
            disabled={draftActive ? !unreadDraftOffers(draft) : !unread}
          >
            Mark all as read
          </button>
        </footer>
      </div>
    </div>
  ) : null;

  return (
    <>
      {!open && !draftActive ? (
        <button
          ref={triggerRef}
          className="fo-wire-trigger"
          type="button"
          onClick={() => openDrawer()}
          aria-label={`News, ${unread} unread stories`}
        >
          <Bell aria-hidden="true" />
          {unread ? <strong>{unread > 99 ? '99+' : unread}</strong> : null}
        </button>
      ) : null}
      {notification && !open && !draftActive ? (
        <FrontOfficeNotificationToast
          logo={<EventTeamLogo event={notification} />}
          meta={
            <>
              <b data-category={categoryFor(notification)}>{categoryFor(notification)}</b>
              <time>
                {relativeNewsTime(
                  String(notification.metadata.sourcePublishedAt ?? notification.createdAt),
                )}
              </time>
            </>
          }
          priority={notification.priority}
          onView={() => openDrawer(notification.id)}
          onDismiss={() => setNotification(null)}
        >
          {notification.headline}
        </FrontOfficeNotificationToast>
      ) : null}
      {toastOffer && !open ? (
        <FrontOfficeNotificationToast
          variant="draft-trade"
          logo={<NotificationTeamLogo primaryAbbr={toastOffer.offer.team} />}
          meta={
            <>
              <b data-category="TRADE_OFFER">TRADE OFFER</b>
              <time>{tradeTime(toastOffer.offer.id, toastOffer.offer.createdPick)}</time>
            </>
          }
          onView={() => draft.view(toastOffer.offer.id)}
          onDismiss={() => useDraftTradeNotifications.setState({ toastId: null })}
        >
          {TEAM_LIST.find((t) => t.abbr === toastOffer.offer.team)?.city ?? toastOffer.offer.team}{' '}
          wants to {toastOffer.offer.intent === 'move_up' ? 'trade up' : 'move back'}
        </FrontOfficeNotificationToast>
      ) : null}
      {mounted && drawer ? createPortal(drawer, document.body) : null}
    </>
  );
}
