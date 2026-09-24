'use client';

import * as React from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, ChevronDown, Star, X } from 'lucide-react';
import PlayerTypeIcon from '@/components/player-type-icon';
import type { Team as StoreTeam } from '@/features/team/team-store';
import { useSaveStore } from '@/features/save/save-store';
import { buildPlayerDetailsModel, type PlayerDetailsSource } from '@/lib/player-details';
import { getFrontOfficeTeamTheme } from '@/lib/team-theme-tokens';
import { apiFetch } from '@/lib/api';
import { summarizeSimulatedPlayerStats } from '@/lib/simulated-player-stats';
import type { FranchiseSimulationState, FrontOfficeEvent } from '@/types/front-office';
import type { PlayerRowDTO } from '@/types/player';
import type { TeamDTO } from '@/types/team';
import styles from './player-details-modal.module.css';

type Action = { label: string; onSelect: () => void; destructive?: boolean };
type PlayerDetailsModalProps = {
  isOpen: boolean;
  source: PlayerDetailsSource | null;
  sources?: PlayerDetailsSource[];
  roster: PlayerRowDTO[];
  teams: Array<TeamDTO | StoreTeam>;
  userTeamAbbr?: string | null;
  capSpace: number;
  capLimit: number;
  onClose: () => void;
  onSelectSource?: (source: PlayerDetailsSource) => void;
  actions?: Action[];
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
};
const tabs = ['Overview', 'Stats', 'Contract', 'Analysis', 'News'] as const;
type Tab = (typeof tabs)[number];
function Card({ title, children }: React.PropsWithChildren<{ title: string }>) {
  return (
    <section className={styles.card}>
      <h3>{title}</h3>
      {children}
    </section>
  );
}
function Facts({ items }: { items: Array<{ label: string; value: string }> }) {
  return (
    <dl className={styles.facts}>
      {items.map(({ label, value }) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}
const positionNames: Record<string, string> = {
  QB: 'Quarterback',
  RB: 'Running back',
  FB: 'Fullback',
  WR: 'Wide receiver',
  TE: 'Tight end',
  OT: 'Offensive tackle',
  LT: 'Left tackle',
  RT: 'Right tackle',
  OG: 'Offensive guard',
  LG: 'Left guard',
  RG: 'Right guard',
  C: 'Center',
  OL: 'Offensive line',
  EDGE: 'Edge rusher',
  ED: 'Edge rusher',
  DE: 'Defensive end',
  DT: 'Defensive tackle',
  DL: 'Defensive line',
  LB: 'Linebacker',
  MLB: 'Middle linebacker',
  OLB: 'Outside linebacker',
  CB: 'Cornerback',
  S: 'Safety',
  FS: 'Free safety',
  SS: 'Strong safety',
  K: 'Kicker',
  P: 'Punter',
  LS: 'Long snapper',
};

export default function PlayerDetailsModal({
  isOpen,
  source,
  sources = [],
  roster,
  teams,
  userTeamAbbr,
  capSpace,
  capLimit,
  onClose,
  onSelectSource,
  actions = [],
  isFavorite,
  onToggleFavorite,
}: PlayerDetailsModalProps) {
  const closeRef = React.useRef<HTMLButtonElement>(null);
  const dialogRef = React.useRef<HTMLDivElement>(null);
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const id = React.useId();
  const [modalBounds, setModalBounds] = React.useState<{ top: number; height: number } | null>(
    null,
  );
  React.useLayoutEffect(() => {
    if (!isOpen) return;
    const header = document.querySelector('[data-site-header]');
    const measure = () => {
      const zoom = Number.parseFloat(getComputedStyle(document.documentElement).zoom) || 1;
      const top = Math.max(0, header?.getBoundingClientRect().bottom ?? 0);
      setModalBounds({
        top: top / zoom,
        height: Math.max(0, (window.visualViewport?.height ?? innerHeight) - top) / zoom,
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
  }, [isOpen]);
  const [tab, setTab] = React.useState<Tab>('Overview');
  const [failedPhoto, setFailedPhoto] = React.useState<string | null>(null);
  const [events, setEvents] = React.useState<FrontOfficeEvent[]>([]);
  const [newsState, setNewsState] = React.useState<'loading' | 'ready' | 'error'>('loading');
  const saveId = useSaveStore((state) => state.saveId);
  const season = useSaveStore((state) => state.franchiseYear);
  const [simulation, setSimulation] = React.useState<FranchiseSimulationState | null>(null);
  const [statsState, setStatsState] = React.useState<'loading' | 'ready' | 'error'>('loading');
  React.useEffect(() => {
    setSimulation(null);
    if (!isOpen || !saveId) {
      setStatsState('ready');
      return;
    }
    let controller: AbortController;
    const load = async () => {
      controller?.abort();
      controller = new AbortController();
      const signal = controller.signal;
      setStatsState('loading');
      try {
        const response = await apiFetch(
          `/api/front-office/simulate?saveId=${encodeURIComponent(saveId)}`,
          { signal },
        );
        if (!response.ok) throw new Error('Unable to load simulation stats');
        const body = (await response.json()) as { state?: FranchiseSimulationState };
        if (!signal.aborted) {
          setSimulation(body.state ?? null);
          setStatsState('ready');
        }
      } catch {
        if (!signal.aborted) setStatsState('error');
      }
    };
    void load();
    window.addEventListener('front-office-simulation-advanced', load);
    window.addEventListener('front-office-week-complete', load);
    return () => {
      controller?.abort();
      window.removeEventListener('front-office-simulation-advanced', load);
      window.removeEventListener('front-office-week-complete', load);
    };
  }, [isOpen, saveId]);
  const simulatedStats = React.useMemo(
    () => summarizeSimulatedPlayerStats(simulation?.games ?? [], source?.player.id ?? ''),
    [simulation, source?.player.id],
  );
  const index = sources.findIndex((entry) => entry.player.id === source?.player.id);
  const previous = index > 0 ? sources[index - 1] : null;
  const next = index >= 0 ? sources[index + 1] : null;
  const model = React.useMemo(
    () =>
      isOpen && source
        ? buildPlayerDetailsModel({
            source,
            roster,
            teams,
            userTeamAbbr,
            capSpace,
            capLimit,
            season: season || undefined,
          })
        : null,
    [isOpen, source, roster, teams, userTeamAbbr, capSpace, capLimit, season],
  );

  React.useEffect(() => {
    setTab('Overview');
    setFailedPhoto(null);
    scrollRef.current?.scrollTo(0, 0);
  }, [source?.player.id, isOpen]);
  React.useEffect(() => {
    if (!isOpen) return;
    const focused = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    return () => {
      document.body.style.overflow = overflow;
      focused?.focus();
    };
  }, [isOpen]);
  React.useEffect(() => {
    if (!isOpen) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
      const target = event.target as HTMLElement;
      const interactive = target.closest(
        'input,textarea,select,[role="tablist"],details,[contenteditable="true"]',
      );
      if (!interactive && event.key === 'ArrowLeft' && previous && onSelectSource) {
        event.preventDefault();
        onSelectSource(previous);
      }
      if (!interactive && event.key === 'ArrowRight' && next && onSelectSource) {
        event.preventDefault();
        onSelectSource(next);
      }
      if (event.key === 'Tab') {
        const elements = Array.from(
          dialogRef.current?.querySelectorAll<HTMLElement>(
            'button:not(:disabled),a[href],summary,[tabindex="0"]',
          ) ?? [],
        ).filter((el) => el.getClientRects().length);
        const first = elements[0],
          last = elements.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        }
        if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose, onSelectSource, previous, next]);
  React.useEffect(() => {
    if (!isOpen || tab !== 'News' || !saveId) return;
    let cancelled = false;
    setEvents([]);
    setNewsState('loading');
    void apiFetch(`/api/front-office/events?saveId=${encodeURIComponent(saveId)}`)
      .then(async (response) => {
        if (!response.ok) throw new Error();
        return response.json();
      })
      .then((body) => {
        if (!cancelled) {
          setEvents(body.events ?? []);
          setNewsState('ready');
        }
      })
      .catch(() => {
        if (!cancelled) setNewsState('error');
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, tab, saveId]);
  if (!isOpen || !source || !model) return null;
  const accent = getFrontOfficeTeamTheme(model.teamAbbr).interactive;
  const parts = model.name.trim().split(/\s+/);
  const surname = parts.length > 1 ? parts.slice(1).join(' ') : parts[0];
  const info = [
    { label: 'Position', value: positionNames[model.position] ?? model.position },
    ...(model.age != null ? [{ label: 'Age', value: String(model.age) }] : []),
    ...(model.height ? [{ label: 'Height', value: model.height }] : []),
    ...(model.weight ? [{ label: 'Weight', value: `${model.weight} lbs` }] : []),
    ...(source.kind !== 'expiring' && (source.player.college || source.player.school)
      ? [{ label: 'College', value: (source.player.college || source.player.school)! }]
      : []),
    {
      label: 'Status',
      value: !model.isFreeAgent
        ? source.kind === 'expiring'
          ? 'Expiring contract'
          : source.player.status
        : 'Free Agent',
    },
  ];
  const stories = events.filter(
    (event) =>
      !event.dismissedAt &&
      (event.playerId === model.id ||
        (Array.isArray(event.metadata.playerIds) && event.metadata.playerIds.includes(model.id))),
  );
  const value =
    model.contractValueTag && !model.isFreeAgent ? (
      <div className={styles.value} data-value={model.contractValueTag}>
        <strong>{model.contractValueTag}</strong>
        <span>Contract value assessment</span>
      </div>
    ) : null;
  const contract = (
    <>
      <Facts items={model.contract} />
      {!model.contract.length && <p>Contract details are not available.</p>}
      {value}
    </>
  );
  const shownStats = simulatedStats.stats.length ? simulatedStats.stats : model.stats;
  const performance = (
    <>
      {statsState === 'loading' ? (
        <p className={styles.empty} role="status">
          Loading simulated season stats…
        </p>
      ) : statsState === 'error' ? (
        <p className={styles.empty} role="alert">
          Unable to load simulated season stats. Reopen this player to try again.
        </p>
      ) : simulatedStats.stats.length ? (
        <p className={styles.empty}>
          {simulation?.season} simulated regular season · {simulatedStats.recordedGames}{' '}
          {simulatedStats.recordedGames === 1 ? 'game' : 'games'} with recorded stats
        </p>
      ) : (
        <p className={styles.empty}>
          No simulated regular-season stats have been recorded for this player yet.
        </p>
      )}
      {!simulatedStats.stats.length && model.stats.length > 0 && (
        <p className={styles.empty}>Imported player snapshot (not simulation totals)</p>
      )}
      {shownStats.length > 0 && (
        <div className={styles.stats}>
          {shownStats.map((stat) => (
            <div key={stat.label}>
              <strong className="front-office-stat-value">{stat.value}</strong>
              <span>{stat.label}</span>
            </div>
          ))}
        </div>
      )}
    </>
  );
  return (
    <div
      className={`app-modal-layer ${styles.backdrop}`}
      onClick={onClose}
      style={
        {
          top: modalBounds?.top ?? 0,
          bottom: 'auto',
          height: modalBounds?.height ?? 0,
          visibility: modalBounds ? 'visible' : 'hidden',
          '--player-modal-top': `${modalBounds?.top ?? 0}px`,
        } as React.CSSProperties
      }
    >
      <div
        ref={dialogRef}
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-name`}
        style={{ '--player-accent': accent, maxHeight: '100%' } as React.CSSProperties}
        onClick={(event) => event.stopPropagation()}
      >
        <div className={styles.scroll} ref={scrollRef}>
          <section className={styles.hero}>
            <div className={styles.utility} role="group" aria-label="Player details controls">
              <span>Player Details</span>
              <div>
                {onSelectSource && (
                  <>
                    <button
                      type="button"
                      disabled={!previous}
                      aria-label="Previous player"
                      onClick={() => previous && onSelectSource(previous)}
                    >
                      <ChevronLeft />
                    </button>
                    <button
                      type="button"
                      disabled={!next}
                      aria-label="Next player"
                      onClick={() => next && onSelectSource(next)}
                    >
                      <ChevronRight />
                    </button>
                  </>
                )}
                <button
                  ref={closeRef}
                  type="button"
                  aria-label="Close player details"
                  onClick={onClose}
                >
                  <X />
                </button>
              </div>
            </div>
            {model.teamLogoUrl && (
              <img
                className={styles.watermarkLogo}
                src={model.teamLogoUrl}
                alt=""
                onError={(event) => {
                  event.currentTarget.style.visibility = 'hidden';
                }}
              />
            )}
            <div className={styles.portrait}>
              <span className={styles.positionWatermark} aria-hidden="true">
                {model.position}
              </span>
              {model.headshotUrl && failedPhoto !== model.headshotUrl ? (
                <img
                  src={model.headshotUrl}
                  alt={model.name}
                  onError={() => setFailedPhoto(model.headshotUrl)}
                />
              ) : (
                <div className={styles.initials} aria-label="Player photo unavailable">
                  {parts
                    .map((part) => part[0])
                    .slice(0, 2)
                    .join('')}
                </div>
              )}
            </div>
            <div className={styles.identity}>
              <h2 id={`${id}-name`}>
                {parts.length > 1 && <span>{parts[0]}</span>}
                <strong>{surname}</strong>
              </h2>
              <div className={styles.distinctions}>
                <PlayerTypeIcon indicator={model.playerTypeIndicator} />
                {onToggleFavorite && (
                  <button
                    type="button"
                    onClick={onToggleFavorite}
                    aria-label={`Favorite ${model.name}`}
                    aria-pressed={Boolean(isFavorite)}
                  >
                    <Star fill={isFavorite ? 'currentColor' : 'none'} />
                  </button>
                )}
              </div>
              <div className={styles.metadata}>
                {[
                  model.position,
                  model.age != null ? `Age ${model.age}` : null,
                  model.height,
                  model.weight ? `${model.weight} lbs` : null,
                ]
                  .filter(Boolean)
                  .map((item) => (
                    <span key={item}>{item}</span>
                  ))}
              </div>
              <div className={styles.teamline}>
                {model.teamLogoUrl && <img src={model.teamLogoUrl} alt="" />}
                <span>
                  {model.teamName ??
                    model.teamAbbr ??
                    (model.isFreeAgent ? 'Free Agent' : 'Team unavailable')}
                </span>
                {model.teamAbbr && <span>{model.contractStatusLine}</span>}
                {model.bestRole && <span>{model.bestRole}</span>}
              </div>
              <div className={styles.heroControls}>
                {model.contractValueTag && !model.isFreeAgent && (
                  <button
                    type="button"
                    className={styles.badge}
                    onClick={() => {
                      setTab('Contract');
                      requestAnimationFrame(() =>
                        document.getElementById(`${id}-tab-Contract`)?.focus(),
                      );
                    }}
                    aria-label={`${model.contractValueTag}: view contract assessment`}
                  >
                    {model.contractValueTag}
                  </button>
                )}
                {actions.length > 0 && (
                  <details className={styles.actions}>
                    <summary>
                      Actions <ChevronDown size={14} />
                    </summary>
                    <div>
                      {actions.map((action) => (
                        <button
                          type="button"
                          key={action.label}
                          data-destructive={action.destructive}
                          onClick={action.onSelect}
                        >
                          {action.label}
                        </button>
                      ))}
                    </div>
                  </details>
                )}
              </div>
            </div>
            <div className={styles.overall}>
              <span>OVR</span>
              <strong className="front-office-stat-value">{model.ratingDisplay}</strong>
            </div>
          </section>
          <nav className={styles.tabs} role="tablist" aria-label="Player information">
            {tabs.map((label, i) => (
              <button
                key={label}
                type="button"
                role="tab"
                id={`${id}-tab-${label}`}
                aria-controls={`${id}-panel`}
                aria-selected={tab === label}
                tabIndex={tab === label ? 0 : -1}
                onClick={() => setTab(label)}
                onKeyDown={(event) => {
                  const target =
                    event.key === 'ArrowRight'
                      ? (i + 1) % tabs.length
                      : event.key === 'ArrowLeft'
                        ? (i + tabs.length - 1) % tabs.length
                        : event.key === 'Home'
                          ? 0
                          : event.key === 'End'
                            ? tabs.length - 1
                            : null;
                  if (target !== null) {
                    event.preventDefault();
                    setTab(tabs[target]);
                    document.getElementById(`${id}-tab-${tabs[target]}`)?.focus();
                  }
                }}
              >
                {label}
              </button>
            ))}
          </nav>
          <div
            className={styles.content}
            role="tabpanel"
            id={`${id}-panel`}
            aria-labelledby={`${id}-tab-${tab}`}
            tabIndex={0}
          >
            {tab === 'Overview' && (
              <>
                <div className={styles.grid}>
                  <Card title="Player Summary">
                    <p>{model.summary}</p>
                  </Card>
                  <Card title="Key Ratings">
                    <div className={styles.ratings}>
                      <div>
                        <strong
                          className="front-office-stat-value"
                          data-elite={(model.rating ?? 0) >= 90}
                        >
                          {model.ratingDisplay}
                        </strong>
                        <span>OVR</span>
                      </div>
                      <p>
                        Individual {model.position} attribute ratings are not available for this
                        player.
                      </p>
                    </div>
                  </Card>
                  <Card title="Player Info">
                    <Facts items={info} />
                  </Card>
                  <Card title="Contract + Value">{contract}</Card>
                </div>
                <Card title="Player Mindset">
                  <div className={styles.mindset}>
                    {model.meters.map((meter) => (
                      <div key={meter.key} title={meter.helper}>
                        <div>
                          <span>{meter.label}</span>
                          <strong>{meter.tier}</strong>
                        </div>
                        <meter
                          min={0}
                          max={100}
                          value={meter.value}
                          aria-label={`${meter.label}: ${meter.tier}`}
                        />
                      </div>
                    ))}
                  </div>
                </Card>
                <Card title="Performance Snapshot">{performance}</Card>
              </>
            )}
            {tab === 'Stats' && <Card title="Performance Snapshot">{performance}</Card>}
            {tab === 'Contract' && (
              <Card title="Current Contract">
                {contract}
                {source.kind !== 'expiring' &&
                  !model.isFreeAgent &&
                  (source.player.contract?.guaranteed ?? 0) > 0 && (
                    <Facts
                      items={[
                        {
                          label: 'Guaranteed',
                          value: `$${source.player.contract!.guaranteed.toFixed(1)}M`,
                        },
                      ]}
                    />
                  )}
              </Card>
            )}
            {tab === 'Analysis' && (
              <div className={styles.grid}>
                <Card title="Roster Role">
                  <p>{model.bestRole ?? 'No current depth-chart role is available.'}</p>
                  <div className={styles.tags}>
                    {model.tags.map((tag) => (
                      <span key={tag}>{tag}</span>
                    ))}
                  </div>
                </Card>
                <Card title="Long-Term Outlook">
                  <p>{model.outlook}</p>
                </Card>
                <Card title="Contract Outlook">{contract}</Card>
              </div>
            )}
            {tab === 'News' && (
              <Card title="Player News">
                {saveId && newsState === 'loading' ? (
                  <p role="status">Loading player stories…</p>
                ) : newsState === 'error' && saveId ? (
                  <p role="status">Player stories could not be loaded. Please try again.</p>
                ) : stories.length ? (
                  stories.map((story) => (
                    <article className={styles.story} key={story.id}>
                      <Link href={`/front-office/league/news/${story.id}`}>
                        <h4>{story.headline}</h4>
                      </Link>
                      <p>{story.summary}</p>
                    </article>
                  ))
                ) : (
                  <p>No recent stories involving this player.</p>
                )}
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
