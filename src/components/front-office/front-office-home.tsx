'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  Activity,
  ArrowDown,
  ArrowRight,
  ArrowUp,
  ArrowLeftRight,
  BriefcaseBusiness,
  CalendarDays,
  ChevronRight,
  Globe,
  HeartPulse,
  MessageSquare,
  Shield,
  TrendingUp,
  Users,
} from 'lucide-react';
import { TEAM_LIST } from '@/data/teams';
import { useSaveStore } from '@/features/save/save-store';
import { useRosterQuery } from '@/features/players/queries';
import { useTeamStore } from '@/features/team/team-store';
import { apiFetch } from '@/lib/api';
import {
  getActiveSimulationRoster,
  FRONT_OFFICE_ACTIVE_ROSTER_LIMIT,
} from '@/lib/front-office-roster';
import { analyzeTeamNeeds, computeTeamOverviewRaw, scaleOverviewScore } from '@/lib/team-overview';
import { phaseDisplayName } from '@/lib/front-office-phase';
import { formatMoneyMillions } from '@/server/logic/cap';
import type {
  FranchiseRecord,
  FranchiseSimulationState,
  FrontOfficeEvent,
  FranchiseTransaction,
} from '@/types/front-office';
import type { PlayerRowDTO } from '@/types/player';
import { FrontOfficeFeatureHeading } from './front-office-feature-heading';
import { FrontOfficePhaseControl } from './front-office-phase-control';
import styles from './front-office-home.module.css';
import { FrontOfficeWeeklyBrief } from './front-office-weekly-brief';

const teamsByAbbr = new Map(TEAM_LIST.map((team) => [team.abbr, team]));
const playerName = (p: PlayerRowDTO) => `${p.firstName} ${p.lastName}`.trim();
const rating = (p: PlayerRowDTO) => p.rating ?? p.maddenRating ?? p.baselineRating ?? null;
const change = (p: PlayerRowDTO) =>
  typeof p.rating === 'number' && typeof p.baselineRating === 'number'
    ? p.rating - p.baselineRating
    : null;
const record = (r?: FranchiseRecord) =>
  r ? `${r.wins}-${r.losses}${r.ties ? `-${r.ties}` : ''}` : '—';
const playerLink = (p: PlayerRowDTO) => `/roster?view=roster&playerId=${encodeURIComponent(p.id)}`;
const stamp = (value: string) =>
  Number.isNaN(Date.parse(value))
    ? ''
    : new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
const localLink = (url: string | null | undefined, fallback: string) =>
  url?.startsWith('/') && !url.startsWith('//') ? url : fallback;
type MarketPlayer = PlayerRowDTO & { availabilityLabel?: string; whyAvailable?: string[] };
type Market = {
  targets: MarketPlayer[];
  tradeEvents: FrontOfficeEvent[];
  recentTrades: Array<{
    id: string;
    playerId: string;
    fromTeamAbbr?: string;
    toTeamAbbr?: string;
    createdAt: string;
  }>;
};
type Schedule = { startsAt: string } | null;

function MarketRow({
  player,
  teamAbbr,
  status,
  intel,
  href,
  title,
}: {
  player?: PlayerRowDTO;
  teamAbbr?: string | null;
  status: string;
  intel: string;
  href: string;
  title?: string;
}) {
  const name = player
    ? playerName(player)
    : (teamsByAbbr.get(teamAbbr ?? '')?.name ?? title ?? 'Trade market');
  return (
    <Link className={styles.marketRow} href={href}>
      <div className={styles.marketPortrait}>
        {player ? <Portrait player={player} size={38} /> : <Logo abbr={teamAbbr} size={32} />}
      </div>
      <strong className={styles.marketName} title={name}>
        {name}
      </strong>
      {player && (
        <small className={styles.marketPosition}>
          {player.position} · {rating(player) ?? '—'} OVR
        </small>
      )}
      <div className={styles.marketTeam}>
        <Logo abbr={teamAbbr} size={26} />
      </div>
      <span className={`${styles.chip} ${styles.marketStatus}`} title={status}>
        {status}
      </span>
      <p className={styles.marketIntel}>{intel || title}</p>
      <ChevronRight className={styles.marketChevron} aria-hidden="true" />
    </Link>
  );
}

function Logo({ abbr, size = 30 }: { abbr?: string | null; size?: number }) {
  const team = teamsByAbbr.get(abbr ?? '');
  return team ? (
    <Image src={team.logoUrl} alt={team.name} width={size} height={size} unoptimized />
  ) : (
    <Shield size={size} aria-hidden="true" />
  );
}
function Portrait({ player, size = 34 }: { player: PlayerRowDTO; size?: number }) {
  const [failed, setFailed] = useState(false);
  return player.headshotUrl && !failed ? (
    <Image
      className={styles.portrait}
      src={player.headshotUrl}
      alt=""
      width={size}
      height={size}
      unoptimized
      onError={() => setFailed(true)}
    />
  ) : (
    <span className={styles.initials} style={{ width: size, height: size }}>
      {player.firstName?.[0]}
      {player.lastName?.[0]}
    </span>
  );
}
function Panel({
  title,
  icon,
  href,
  link = 'View All',
  className = '',
  children,
}: {
  title: string;
  icon: ReactNode;
  href?: string;
  link?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={`${styles.panel} ${className}`} aria-label={title}>
      <header>
        <h2>
          {icon}
          {title}
        </h2>
        {href && (
          <Link href={href}>
            {link}
            <ArrowRight aria-hidden="true" />
          </Link>
        )}
      </header>
      {children}
    </section>
  );
}
function Empty({ children }: { children: ReactNode }) {
  return <p className={styles.empty}>{children}</p>;
}
function Delta({ value }: { value: number | null }) {
  return (
    <span
      className={
        value === null || value === 0
          ? styles.stable
          : value > 0
            ? styles.positive
            : styles.negative
      }
    >
      {value === null ? '—' : value > 0 ? `+${value}` : value}
    </span>
  );
}
function EventList({ events, count = 4 }: { events: FrontOfficeEvent[]; count?: number }) {
  return (
    <div className={styles.eventList}>
      {events.slice(0, count).map((event) => (
        <Link
          key={event.id}
          href={localLink(event.actionUrl, '/front-office/league/news')}
          title={event.headline}
        >
          <Logo abbr={event.relatedTeamAbbr ?? event.teamAbbr} size={25} />
          <span>
            <strong>{event.headline}</strong>
            <small>{stamp(event.createdAt)}</small>
          </span>
          <ChevronRight aria-hidden="true" />
        </Link>
      ))}
      {!events.length && <Empty>No new league updates.</Empty>}
    </div>
  );
}

export function FrontOfficeHome({
  saveId,
  teamAbbr,
  roster: cachedRoster,
}: {
  saveId: string;
  teamAbbr: string;
  roster: PlayerRowDTO[];
}) {
  const save = useSaveStore();
  const teams = useTeamStore((s) => s.teams);
  const {
    data: freshRoster,
    error: rosterError,
    refresh: refreshRoster,
  } = useRosterQuery(saveId, teamAbbr);
  const roster = freshRoster.length ? freshRoster : cachedRoster;
  const activeRoster = useMemo(
    () =>
      getActiveSimulationRoster(
        roster,
        teamAbbr,
        save.rosterLimit || FRONT_OFFICE_ACTIVE_ROSTER_LIMIT,
      ),
    [roster, teamAbbr, save.rosterLimit],
  );
  const [simulation, setSimulation] = useState<FranchiseSimulationState | null>(null);
  const [events, setEvents] = useState<FrontOfficeEvent[]>([]);
  const [market, setMarket] = useState<Market>({ targets: [], tradeEvents: [], recentTrades: [] });
  const [schedule, setSchedule] = useState<Schedule>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  const [marketTab, setMarketTab] = useState<string | null>(null);
  const [developmentTab, setDevelopmentTab] = useState<string | null>(null);
  const [briefOpen, setBriefOpen] = useState(false);
  const [failedHero, setFailedHero] = useState<string | null>(null);
  const closeBrief = useMemo(() => () => setBriefOpen(false), []);
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const load = async () => {
      setLoading(true);
      const urls = ['simulate', 'events', 'trade-hub'];
      const results = await Promise.allSettled(
        urls.map(async (url) => {
          const response = await apiFetch(
            `/api/front-office/${url}?saveId=${encodeURIComponent(saveId)}`,
            { signal: controller.signal },
          );
          const json = await response.json();
          if (!response.ok) throw new Error(json.error ?? `Unable to load ${url}.`);
          return json;
        }),
      );
      if (!active) return;
      const [sim, feed, trades] = results;
      if (sim.status === 'fulfilled') {
        setSimulation(sim.value.state ?? null);
        setSchedule(sim.value.nextGameSchedule ?? null);
      }
      if (feed.status === 'fulfilled') setEvents(feed.value.events ?? []);
      if (trades.status === 'fulfilled')
        setMarket({
          targets: trades.value.targets ?? [],
          tradeEvents: trades.value.tradeEvents ?? [],
          recentTrades: trades.value.recentTrades ?? [],
        });
      setErrors(
        results.flatMap((r, i) =>
          r.status === 'rejected'
            ? [
                urls[i] === 'simulate'
                  ? 'Franchise schedule'
                  : urls[i] === 'events'
                    ? 'League updates'
                    : 'Trade market',
              ]
            : [],
        ),
      );
      setLoading(false);
    };
    void load();
    const reload = () => void load();
    window.addEventListener('front-office-simulation-advanced', reload);
    window.addEventListener('front-office-week-complete', reload);
    return () => {
      active = false;
      controller.abort();
      window.removeEventListener('front-office-simulation-advanced', reload);
      window.removeEventListener('front-office-week-complete', reload);
    };
  }, [saveId, revision]);
  const team = teams.find((t) => t.abbr === teamAbbr);
  const ownState = simulation?.teams[teamAbbr];
  const nextGame = simulation?.games.find(
    (game) => !game.played && [game.homeTeam, game.awayTeam].includes(teamAbbr),
  );
  const opponent = nextGame
    ? nextGame.homeTeam === teamAbbr
      ? nextGame.awayTeam
      : nextGame.homeTeam
    : null;
  const week = nextGame?.week ?? simulation?.currentWeek;
  const overall = useMemo(() => {
    if (!activeRoster.length) return ownState?.overall ?? team?.teamOverview ?? null;
    const bounds = teams
      .map((t) => t.teamOverviewRaw)
      .filter((n): n is number => typeof n === 'number');
    const raw = computeTeamOverviewRaw(activeRoster).overall;
    return bounds.length > 1
      ? scaleOverviewScore(raw, Math.min(...bounds), Math.max(...bounds), 69, 91)
      : Math.round(raw);
  }, [activeRoster, ownState?.overall, team?.teamOverview, teams]);
  const needs = useMemo(() => analyzeTeamNeeds(activeRoster).slice(0, 5), [activeRoster]);
  const development = useMemo(
    () =>
      [...activeRoster].sort(
        (a, b) =>
          (change(b) ?? -Infinity) - (change(a) ?? -Infinity) ||
          (rating(b) ?? 0) - (rating(a) ?? 0),
      ),
    [activeRoster],
  );
  const up = development.filter((p) => (change(p) ?? 0) > 0),
    down = development.filter((p) => (change(p) ?? 0) < 0);
  const activeDevelopmentTab = developmentTab ?? (up.length ? 'up' : 'all');
  const devRows =
    activeDevelopmentTab === 'up' ? up : activeDevelopmentTab === 'down' ? down : development;
  const spotlight = up[0] ?? development.find((p) => change(p) !== null) ?? development[0];
  const playerEvents = events.filter(
    (e) => e.teamAbbr === teamAbbr || e.relatedTeamAbbr === teamAbbr,
  );
  const featured =
    activeRoster.find((p) =>
      playerEvents.some(
        (e) => e.playerId === p.id && ['trade_interest', 'trade_rumor'].includes(e.type),
      ),
    ) ?? [...activeRoster].sort((a, b) => (rating(b) ?? 0) - (rating(a) ?? 0))[0];
  const featuredEvent =
    playerEvents.find((e) => e.type !== 'welcome_message' && e.playerId === featured?.id) ??
    playerEvents.find((e) =>
      ['trade_interest', 'trade_rumor', 'trade_offer', 'deadline_alert'].includes(e.type),
    );
  const summary =
    featuredEvent?.summary ??
    (loading
      ? 'Loading this week’s franchise storylines…'
      : `${up.length} ${up.length === 1 ? 'player is' : 'players are'} above their stored baseline rating. Review your roster needs${opponent ? ` ahead of ${teamsByAbbr.get(opponent)?.name ?? opponent}` : ' and plan your next moves'}.`);
  const rumors = market.tradeEvents.filter((e) =>
    ['trade_rumor', 'trade_interest', 'trade_offer'].includes(e.type),
  );
  const ownRumors = rumors.filter((e) => e.teamAbbr === teamAbbr || e.relatedTeamAbbr === teamAbbr);
  const activeMarketTab = marketTab ?? (rumors.length ? 'rumors' : 'available');
  const currentRumors = activeMarketTab === 'own' ? ownRumors : rumors;
  const movement = events.filter((e) =>
    ['league_transaction', 'free_agent_signing', 'player_release', 'contract_extension'].includes(
      e.type,
    ),
  );
  const injuries = roster.filter((p) =>
    /injur|\bir\b|\bpup\b|questionable|doubtful|limited/i.test(p.status ?? ''),
  );
  const division = Object.values(simulation?.teams ?? {})
    .filter((t) => t.conference === ownState?.conference && t.division === ownState?.division)
    .sort(
      (a, b) =>
        b.record.wins - a.record.wins ||
        a.record.losses - b.record.losses ||
        a.abbr.localeCompare(b.abbr),
    );
  const transactions: FranchiseTransaction[] = [...(simulation?.transactions ?? [])]
    .filter((t) => t.teamAbbr === teamAbbr)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 4);
  const kickoff =
    schedule?.startsAt && !Number.isNaN(Date.parse(schedule.startsAt))
      ? new Date(schedule.startsAt).toLocaleString('en-US', {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
          timeZone: 'America/New_York',
          timeZoneName: 'short',
        })
      : null;
  const gameHref = nextGame?.played
    ? `/front-office/game/${nextGame.id}`
    : '/front-office/league/schedule';
  const rosterSize = `${activeRoster.length} / ${save.rosterLimit || FRONT_OFFICE_ACTIVE_ROSTER_LIMIT}`;

  return (
    <div className={styles.dashboard} aria-label="Front Office Home">
      <section className={styles.status} aria-label="Franchise status">
        <dl>
          {[
            [overall ?? '—', 'Team OVR', 'OVR'],
            [record(ownState?.record), 'Record', 'Record'],
            [formatMoneyMillions(save.capSpace), 'Cap Space', 'Cap'],
            [rosterSize, 'Roster Size', 'Roster'],
          ].map(([value, label, mobileLabel]) => (
            <div key={label} data-long-value={String(value).replace(/\s/g, '').length > 6}>
              <dd>
                <span className="front-office-stat-value">
                  {label === 'Roster Size' ? (
                    <>
                      <span className={styles.desktopOnly}>{value}</span>
                      <span className={styles.mobileOnly}>{String(value).replace(/\s/g, '')}</span>
                    </>
                  ) : (
                    value
                  )}
                </span>
                {label === 'Team OVR' &&
                  save.startingOverall != null &&
                  overall != null &&
                  overall !== save.startingOverall && (
                    <small>
                      <Delta value={overall - save.startingOverall} />
                    </small>
                  )}
              </dd>
              <dt>
                <span className={styles.desktopOnly}>{label}</span>
                <span className={styles.mobileOnly}>{mobileLabel}</span>
              </dt>
            </div>
          ))}
        </dl>
        <Link className={styles.statusGame} href={gameHref}>
          <Logo abbr={opponent} size={48} />
          <span className={styles.desktopOnly}>
            <strong>{week ? `Week ${week}` : 'Schedule'}</strong>
            <small>
              {opponent
                ? `Next game vs ${teamsByAbbr.get(opponent)?.name.split(' ').slice(-1)[0] ?? opponent}`
                : 'Next matchup pending'}
            </small>
            <small>{kickoff ?? (loading ? 'Loading schedule…' : 'Kickoff time TBD')}</small>
          </span>
          <span className={styles.mobileOnly}>
            <strong>
              {/^week-/.test(save.phase) && week ? `Week ${week}` : phaseDisplayName(save.phase)} ·{' '}
              {opponent
                ? `vs ${teamsByAbbr.get(opponent)?.name.split(' ').slice(-1)[0] ?? opponent}`
                : 'Schedule'}
            </strong>
          </span>
          <ChevronRight className={styles.mobileOnly} size={18} aria-hidden="true" />
        </Link>
      </section>
      <section className={styles.hero} aria-label="Weekly feature">
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}>
            <CalendarDays size={14} />
            <span className={styles.desktopOnly}>{week ? `Week ${week}` : 'Weekly focus'}</span>
            <span className={styles.mobileOnly}>Weekly focus</span>
          </p>
          <FrontOfficeFeatureHeading>{'Focus: Build\nfor the long term'}</FrontOfficeFeatureHeading>
          <p className={styles.heroSummary}>
            {featured && summary.includes(playerName(featured))
              ? summary.split(playerName(featured)).map((part, index) => (
                  <span key={index}>
                    {index > 0 && <mark>{playerName(featured)}</mark>}
                    {part}
                  </span>
                ))
              : summary}
          </p>
          <button className={styles.cta} onClick={() => setBriefOpen(true)}>
            View Weekly Brief <ArrowRight size={16} />
          </button>
        </div>
        {featured?.headshotUrl && failedHero !== featured.id && (
          <Image
            className={styles.heroPhoto}
            src={featured.headshotUrl}
            alt={playerName(featured)}
            width={440}
            height={360}
            unoptimized
            onError={() => setFailedHero(featured.id)}
          />
        )}
        {featured && (
          <div className={styles.heroPlayer}>
            <Link href={playerLink(featured)}>{playerName(featured)}</Link>
            <span>
              {featured.position}
              {featured.age ? ` · Age ${featured.age}` : ''}
            </span>
            <i />
            <small>Franchise spotlight</small>
            <span className={`front-office-stat-value ${styles.heroRating}`}>
              {rating(featured) ?? '—'} <small>OVR</small>
            </span>
          </div>
        )}
      </section>
      <Panel
        title="Trade Market"
        icon={<ArrowLeftRight />}
        href="/front-office/trade-hub"
        className={styles.market}
      >
        <div className={styles.tabs} role="group" aria-label="Trade market filters">
          {[
            ['rumors', `All Rumors (${rumors.length})`],
            ['available', `Available Players (${market.targets.length})`],
            ['own', `Your Players (${ownRumors.length})`],
            ['activity', 'Recent Activity'],
          ].map(([key, label]) => (
            <button
              key={key}
              aria-pressed={activeMarketTab === key}
              onClick={() => setMarketTab(key)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className={styles.marketRows}>
          {activeMarketTab === 'available'
            ? market.targets
                .slice(0, 4)
                .map((p) => (
                  <MarketRow
                    key={p.id}
                    player={p}
                    teamAbbr={p.currentTeamAbbr ?? p.teamAbbr}
                    status={p.availabilityLabel ?? 'Available'}
                    intel={p.whyAvailable?.join('. ') || 'Review this player in Trade Hub.'}
                    href={`/front-office/trade-hub/player/${encodeURIComponent(p.id)}`}
                  />
                ))
            : activeMarketTab === 'activity'
              ? market.recentTrades
                  .slice(0, 4)
                  .map((t) => (
                    <MarketRow
                      key={t.id}
                      player={
                        roster.find((p) => p.id === t.playerId) ??
                        market.targets.find((p) => p.id === t.playerId)
                      }
                      teamAbbr={t.toTeamAbbr}
                      status="Traded"
                      title="Completed trade"
                      intel={`${t.fromTeamAbbr ?? 'Previous team'} → ${t.toTeamAbbr ?? 'New team'} · ${stamp(t.createdAt)}`}
                      href="/front-office/trade-hub/activity"
                    />
                  ))
              : currentRumors
                  .slice(0, 4)
                  .map((e) => (
                    <MarketRow
                      key={e.id}
                      player={
                        roster.find((p) => p.id === e.playerId) ??
                        market.targets.find((p) => p.id === e.playerId)
                      }
                      teamAbbr={e.relatedTeamAbbr ?? e.teamAbbr}
                      title={e.headline}
                      status={
                        e.type === 'trade_offer'
                          ? 'Offer'
                          : e.type === 'trade_interest'
                            ? 'Interest'
                            : 'Rumor'
                      }
                      intel={e.summary}
                      href={localLink(e.actionUrl, '/front-office/trade-hub')}
                    />
                  ))}
          {(activeMarketTab === 'available'
            ? !market.targets.length
            : activeMarketTab === 'activity'
              ? !market.recentTrades.length
              : !currentRumors.length) && (
            <Empty>
              {loading
                ? 'Loading trade market…'
                : errors.includes('Trade market')
                  ? 'Trade market unavailable. Retry below.'
                  : 'No current updates in this market view.'}
            </Empty>
          )}
        </div>
      </Panel>
      <Panel
        title="Player Development"
        icon={<TrendingUp />}
        href="/front-office/development"
        className={styles.development}
      >
        <div className={styles.tabs} role="group" aria-label="Player development filters">
          {[
            ['up', `Trending Up (${up.length})`],
            ['down', `Trending Down (${down.length})`],
            ['all', 'All Players'],
          ].map(([key, label]) => (
            <button
              key={key}
              aria-pressed={activeDevelopmentTab === key}
              onClick={() => setDevelopmentTab(key)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className={styles.devHead}>
          <span>Player</span>
          <span>Pos</span>
          <span>OVR</span>
          <span>Change</span>
          <span>Trend</span>
        </div>
        {devRows.slice(0, 5).map((p) => (
          <Link className={styles.devRow} href={playerLink(p)} key={p.id}>
            <span>
              <Portrait player={p} size={28} />
              <strong>{playerName(p)}</strong>
            </span>
            <span>{p.position}</span>
            <span>{rating(p) ?? '—'}</span>
            <Delta value={change(p)} />
            <span>
              {(change(p) ?? 0) > 0 ? (
                <ArrowUp className={styles.positive} />
              ) : (change(p) ?? 0) < 0 ? (
                <ArrowDown className={styles.negative} />
              ) : (
                '—'
              )}
              <ChevronRight />
            </span>
          </Link>
        ))}
        {!devRows.length && (
          <Empty>
            {activeDevelopmentTab === 'up'
              ? 'No players above their baseline yet.'
              : activeDevelopmentTab === 'down'
                ? 'No players below their baseline.'
                : 'No roster data available.'}
          </Empty>
        )}
        <small className={styles.caption}>
          Changes compare current ratings with the stored baseline.
        </small>
      </Panel>
      <Panel
        title="Roster & Needs"
        icon={<BriefcaseBusiness />}
        href="/roster?view=roster"
        link="View Roster"
        className={styles.needs}
      >
        <div className={styles.miniMetrics}>
          {[
            [rosterSize, 'Roster Size', 'Roster'],
            [formatMoneyMillions(save.capSpace), 'Cap Space', 'Cap'],
            [overall ?? '—', 'Team OVR', 'OVR'],
          ].map(([value, label, mobileLabel]) => (
            <div key={label}>
              <strong className="front-office-stat-value">{value}</strong>
              <small>{label}</small>
            </div>
          ))}
        </div>
        <h3 className={styles.smallHeading}>Top Needs</h3>
        <ol className={styles.needRows}>
          {needs.map((n) => (
            <li key={n.position}>
              <span>{n.rank}</span>
              <strong>{n.position}</strong>
              <small data-level={n.level}>{n.level}</small>
            </li>
          ))}
        </ol>
        {!!(roster.length - activeRoster.length) && (
          <small className={styles.caption}>
            {roster.length - activeRoster.length} players outside the active lineup.
          </small>
        )}
      </Panel>
      <Panel
        title="Development Spotlight"
        icon={<Activity />}
        href={spotlight ? playerLink(spotlight) : '/front-office/development'}
        link="View Player"
        className={styles.spotlight}
      >
        {spotlight ? (
          <>
            <div className={styles.spotlightTop}>
              <Portrait player={spotlight} size={76} />
              <div>
                <strong>{playerName(spotlight)}</strong>
                <small>
                  {spotlight.position}
                  {spotlight.age ? ` · Age ${spotlight.age}` : ''}
                </small>
                <span className={styles.chip}>
                  <Delta value={change(spotlight)} /> OVR
                </span>
              </div>
              <div className={styles.ratingPair}>
                <strong className="front-office-stat-value">{rating(spotlight) ?? '—'}</strong>
                <small>OVR</small>
                <strong className="front-office-stat-value">
                  {spotlight.baselineRating ?? '—'}
                </strong>
                <small>Baseline</small>
              </div>
            </div>
            {change(spotlight) !== null && (
              <div className={styles.trendChart}>
                <svg
                  viewBox="0 0 240 48"
                  role="img"
                  aria-label={`Baseline ${spotlight.baselineRating}, current ${rating(spotlight)}. This is a two-point comparison, not historical progression.`}
                >
                  <path d="M8 40H232" className={styles.chartAxis} />
                  <path
                    d={`M8 ${change(spotlight)! > 0 ? 36 : change(spotlight)! < 0 ? 12 : 24} L232 ${change(spotlight)! > 0 ? 12 : change(spotlight)! < 0 ? 36 : 24}`}
                  />
                  <circle
                    cx="8"
                    cy={change(spotlight)! > 0 ? 36 : change(spotlight)! < 0 ? 12 : 24}
                    r="3"
                  />
                  <circle
                    cx="232"
                    cy={change(spotlight)! > 0 ? 12 : change(spotlight)! < 0 ? 36 : 24}
                    r="3"
                  />
                </svg>
                <div>
                  <span>Stored baseline</span>
                  <span>Current</span>
                </div>
              </div>
            )}
            <p className={styles.spotlightCopy}>
              {change(spotlight) === null
                ? 'A baseline rating is not available for comparison.'
                : `Current evaluation is ${Math.abs(change(spotlight)!)} ${Math.abs(change(spotlight)!) === 1 ? 'point' : 'points'} ${change(spotlight)! < 0 ? 'below' : 'above'} the stored baseline.`}
            </p>
            <div className={styles.spotlightFoot}>
              <small>
                {spotlight.contract?.yearsRemaining ?? spotlight.contractYearsRemaining} yrs left
              </small>
              <Link href={playerLink(spotlight)}>
                View Details <ArrowRight />
              </Link>
            </div>
          </>
        ) : (
          <Empty>Player development data will appear with your roster.</Empty>
        )}
      </Panel>
      <Panel
        title="League Movement"
        icon={<Globe />}
        href="/league?view=transactions"
        className={styles.movement}
      >
        <EventList events={movement} count={5} />
      </Panel>
      <aside className={styles.rail} aria-label="Franchise updates">
        <section className={styles.advance} aria-label="Advance franchise">
          <FrontOfficePhaseControl
            season={save.franchiseYear}
            phase={save.phase}
            freeAgencyWave={save.freeAgencyWave}
          />
        </section>
        <Panel
          title="Next Game"
          icon={<CalendarDays />}
          href={gameHref}
          link="View Schedule"
          className={styles.nextGame}
        >
          {nextGame && opponent ? (
            <>
              <div className={styles.matchup}>
                <div>
                  <Logo abbr={teamAbbr} size={58} />
                  <strong>{teamAbbr}</strong>
                  <small>{record(ownState?.record)}</small>
                </div>
                <span>VS</span>
                <div>
                  <Logo abbr={opponent} size={58} />
                  <strong>{opponent}</strong>
                  <small>{record(simulation?.teams[opponent]?.record)}</small>
                </div>
              </div>
              <p className={styles.gameTime}>
                {kickoff ?? 'Kickoff time not published'}
                <small>
                  {nextGame.homeTeam === teamAbbr ? 'Home' : 'Away'} · Week {nextGame.week}
                </small>
              </p>
            </>
          ) : (
            <Empty>
              {loading
                ? 'Loading next matchup…'
                : simulation?.completedAt
                  ? 'Season complete. Review your season recap.'
                  : 'Your next matchup is not available yet.'}
            </Empty>
          )}
        </Panel>
        <Panel
          title="Injury Report"
          icon={<HeartPulse />}
          href="/roster?view=roster"
          className={styles.injuries}
        >
          <div className={styles.injuryHead}>
            <span>Player</span>
            <span>Pos</span>
            <span>Status</span>
          </div>
          {injuries.slice(0, 3).map((p) => (
            <Link className={styles.injuryRow} key={p.id} href={playerLink(p)}>
              <span>
                <Portrait player={p} size={22} />
                {playerName(p)}
              </span>
              <span>{p.position}</span>
              <small className={styles.chip}>{p.status}</small>
            </Link>
          ))}
          {!injuries.length && <Empty>No injury designations in the saved roster.</Empty>}
        </Panel>
        <Panel
          title={ownState ? `${ownState.conference} ${ownState.division}` : 'Division Standings'}
          icon={<Shield />}
          href="/front-office/league/standings"
          link="Full Standings"
          className={styles.standings}
        >
          <div className={styles.standingsHead}>
            <span>Team</span>
            <span>W</span>
            <span>L</span>
            <span>T</span>
            <span>PCT</span>
          </div>
          {division.map((t) => {
            const games = t.record.wins + t.record.losses + t.record.ties;
            return (
              <div className={styles.standingsRow} data-own={t.abbr === teamAbbr} key={t.abbr}>
                <span>
                  <Logo abbr={t.abbr} size={20} />
                  {teamsByAbbr.get(t.abbr)?.name.split(' ').slice(-1)[0] ?? t.abbr}
                </span>
                <span>{t.record.wins}</span>
                <span>{t.record.losses}</span>
                <span>{t.record.ties}</span>
                <span>
                  {games ? ((t.record.wins + t.record.ties / 2) / games).toFixed(3) : '.000'}
                </span>
              </div>
            );
          })}
          {!division.length && <Empty>Standings are not available yet.</Empty>}
        </Panel>
        <Panel
          title="Recent Transactions"
          icon={<Users />}
          href="/league?view=transactions"
          className={styles.transactions}
        >
          <div className={styles.transactionRows}>
            {transactions.map((t) => (
              <Link key={t.id} href="/league?view=transactions">
                <small>{stamp(t.createdAt)}</small>
                <span>
                  {t.type === 're-sign'
                    ? 'Re-signed'
                    : t.type === 'signing'
                      ? 'Signed'
                      : t.type === 'cut'
                        ? 'Released'
                        : t.type}
                </span>
                <strong>{t.playerName ?? t.summary}</strong>
              </Link>
            ))}
            {!transactions.length && <Empty>No franchise transactions yet.</Empty>}
          </div>
        </Panel>
        <Panel
          title="The Wire"
          icon={<MessageSquare />}
          href="/front-office/league/news"
          link="All News"
          className={styles.wire}
        >
          <EventList events={events.filter((e) => e.type !== 'welcome_message')} count={3} />
        </Panel>
      </aside>
      {(errors.length > 0 || rosterError) && (
        <div className={styles.loadNotice} role="status">
          {[...errors, ...(rosterError ? ['Roster refresh'] : [])].join(', ')} unavailable. Saved
          information remains visible.{' '}
          <button
            onClick={() => {
              setRevision((n) => n + 1);
              void refreshRoster();
            }}
          >
            Retry
          </button>
        </div>
      )}
      {briefOpen && (
        <FrontOfficeWeeklyBrief
          events={events}
          summary={summary}
          player={featured}
          teamAbbr={teamAbbr}
          period={/^week-/.test(save.phase) && week ? `Week ${week}` : phaseDisplayName(save.phase)}
          saveId={saveId}
          onRead={(ids) =>
            setEvents((previous) =>
              previous.map((event) =>
                ids.includes(event.id) ? { ...event, readAt: new Date().toISOString() } : event,
              ),
            )
          }
          onClose={closeBrief}
        />
      )}
    </div>
  );
}
