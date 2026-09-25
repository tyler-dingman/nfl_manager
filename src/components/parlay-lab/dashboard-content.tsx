'use client';
import { marketDisplayName } from '@/lib/parlay-lab/market-display';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Plus, ArrowRight } from 'lucide-react';
import { TEAM_LIST } from '@/data/teams';
import type { Team } from '@/features/team/team-store';
import { getEditorialHeroTheme } from '@/lib/team-theme-tokens';
import { DdGameCenterIcon, DdTeamAnalyticsIcon } from '@/components/ui/football-icons';
import { NextGameHeroCard } from '@/components/home/next-game-hero-card';
import { LabTrendsIcon, LabStatsIcon, LabInsightsIcon, LabExperimentIcon } from './lab-icons';
import { ParlayLabHero } from './parlay-lab-hero';
import PlayerAvatar from './PlayerAvatar';
import type { HomeMarket } from './ParlayLabHome';
import { representativeTrends, compactTrendReason } from './trending-context';
import { matchesTrendingMarketFilter } from './trending-market-filter';
import { sportsbookName } from '@/server/odds/sportsbooks';
import { LabScoreGuide } from './TrendEducation';
import { PlayersDashboard } from './players-dashboard';
import { GeneratorDashboard } from './generator-dashboard';
import ParlaySortHeader from './ParlaySortHeader';
import { nextSort, sortTableRows, americanOddsToDecimal, type SortState } from './parlay-table';

type DirectoryPlayer = {
  id: string;
  name: string;
  position: string;
  teamAbbr: string;
  headshotUrl: string | null;
};
export type GeneratorSetup = { prompt: string; legs: number; eventId: string };
export type DashboardMode =
  | 'home'
  | 'trends'
  | 'games'
  | 'players'
  | 'teams'
  | 'generator'
  | 'settings';
export type DashboardEvent = {
  id: string;
  homeTeamId: string;
  awayTeamId: string;
  kickoffAt: string;
  week?: number;
  season?: number;
  venue?: string;
  marketsLocked?: boolean;
};
function matchesCategory(m: HomeMarket, category: string) {
  const name = `${m.marketType} ${m.statId}`.toUpperCase();
  if (category === 'YARDS') return name.includes('YARD');
  if (category === 'RECEPTIONS') return name.includes('RECEPTION');
  if (category === 'KICKERS') return /FIELD_GOAL|KICKING|EXTRA_POINT/.test(name);
  if (category === 'DEFENSIVE') return /TACKLE|SACK|PASS_DEFEND/.test(name);
  return matchesTrendingMarketFilter(m, category);
}
const label = (m: HomeMarket) =>
  marketDisplayName(m.marketType === 'OTHER' ? m.statId : m.marketType);
const pick = (m: HomeMarket) =>
  `${m.side === 'OVER' ? 'O' : m.side === 'UNDER' ? 'U' : m.side} ${m.line ?? ''}`;
const odds = (n: number | null) => (n == null ? '—' : `${n > 0 ? '+' : ''}${n}`);
const date = (e: DashboardEvent) =>
  new Date(e.kickoffAt).toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
function Logo({ abbr }: { abbr: string }) {
  const t = TEAM_LIST.find((t) => t.abbr === abbr);
  return t ? (
    <Image src={t.logoUrl} width={56} height={48} unoptimized alt={t.name} />
  ) : (
    <span>{abbr}</span>
  );
}
function Score({ value }: { value?: number }) {
  return (
    <strong
      className="lab-score"
      data-tier={value == null ? 'none' : value >= 70 ? 'good' : value >= 50 ? 'mid' : 'low'}
    >
      {value == null ? '—' : Math.round(value)}
    </strong>
  );
}
function Panel({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="lab-panel">
      <header>
        <h2>
          {icon}
          {title}
        </h2>
      </header>
      {children}
    </section>
  );
}
type MovementRow = {
  marketId: string;
  sportsbook: string;
  oldLine: number | null;
  newLine: number | null;
  oldOdds: number | null;
  newOdds: number | null;
};
function Movement({
  alerts = false,
  markets,
  onOpen,
}: {
  alerts?: boolean;
  markets: HomeMarket[];
  onOpen: (m: HomeMarket) => void;
}) {
  const [tab, setTab] = useState('Line Movement');
  const [columnSort, setColumnSort] = useState<SortState>(null);
  const [changes, setChanges] = useState<MovementRow[]>([]),
    [loading, setLoading] = useState(true);
  useEffect(() => {
    const c = new AbortController();
    fetch('/api/parlay-lab/movement', { signal: c.signal })
      .then((r) => (r.ok ? r.json() : { movements: [] }))
      .then((b) => {
        if (!c.signal.aborted) setChanges(b.movements ?? []);
      })
      .catch(() => {})
      .finally(() => {
        if (!c.signal.aborted) setLoading(false);
      });
    return () => c.abort();
  }, []);
  const movementRows = changes
    .map((row) => ({
      row,
      market: markets.find((m) => m.id === row.marketId && m.sportsbook === row.sportsbook),
    }))
    .filter(
      ({ row, market }) =>
        market &&
        (tab === 'Line Movement'
          ? row.oldLine != null && row.newLine != null && row.oldLine !== row.newLine
          : row.oldOdds != null && row.newOdds != null && row.oldOdds !== row.newOdds),
    );
  const rows = sortTableRows(movementRows, columnSort, {
    player: (item) => `${item.market?.playerName ?? ''} ${item.market?.teamId ?? ''}`,
    market: (item) => (item.market ? label(item.market) : null),
    price: (item) =>
      tab === 'Line Movement'
        ? item.row.newLine
        : item.row.newOdds == null
          ? null
          : americanOddsToDecimal(item.row.newOdds),
    delta: (item) =>
      tab === 'Line Movement'
        ? item.row.newLine! - item.row.oldLine!
        : item.row.newOdds! - item.row.oldOdds!,
  }).slice(0, 5);
  return (
    <Panel title={alerts ? 'Line Movement Alerts' : 'Market Movers'} icon={<LabStatsIcon />}>
      {!alerts && (
        <div className="lab-tabs lab-subtle-tabs">
          {['Line Movement', 'Odds Movement', 'Most Bet'].map((t) => (
            <button key={t} aria-pressed={tab === t} onClick={() => setTab(t)}>
              {t}
            </button>
          ))}
        </div>
      )}
      {tab !== 'Most Bet' && rows.length ? (
        <div className="lab-table-scroll">
          <table>
            <thead>
              <tr>
                <ParlaySortHeader
                  as="th"
                  label="Player / Team"
                  sortKey="player"
                  sort={columnSort}
                  onSort={(key) => setColumnSort((current) => nextSort(current, key))}
                />
                <ParlaySortHeader
                  as="th"
                  label="Market"
                  sortKey="market"
                  sort={columnSort}
                  onSort={(key) => setColumnSort((current) => nextSort(current, key))}
                />
                <ParlaySortHeader
                  as="th"
                  label="Old → New"
                  sortKey="price"
                  sort={columnSort}
                  onSort={(key) => setColumnSort((current) => nextSort(current, key))}
                />
                <ParlaySortHeader
                  as="th"
                  label="Δ"
                  sortKey="delta"
                  sort={columnSort}
                  onSort={(key) => setColumnSort((current) => nextSort(current, key))}
                />
              </tr>
            </thead>
            <tbody>
              {rows.map(({ row, market }) => {
                const before = tab === 'Line Movement' ? row.oldLine! : row.oldOdds!,
                  after = tab === 'Line Movement' ? row.newLine! : row.newOdds!;
                return (
                  <tr key={row.marketId + row.sportsbook}>
                    <td>
                      <button onClick={() => onOpen(market!)} className="lab-player">
                        <PlayerAvatar
                          name={market!.playerName}
                          headshotUrl={market!.headshotUrl}
                          transparent
                        />
                        <span>
                          {market!.playerName}
                          <small>{market!.teamId}</small>
                        </span>
                      </button>
                    </td>
                    <td>{label(market!)}</td>
                    <td>
                      {before} → {after}
                    </td>
                    <td className={after - before >= 0 ? 'lab-positive' : 'lab-negative'}>
                      {after - before > 0 ? '+' : ''}
                      {Number((after - before).toFixed(2))}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="lab-empty">
          {loading
            ? 'Loading saved movement…'
            : tab === 'Most Bet'
              ? 'Betting popularity data is not available.'
              : 'No saved movement is available for the current props.'}
        </div>
      )}
    </Panel>
  );
}
export function DashboardContent({
  mode,
  team,
  markets,
  events,
  loading,
  error,
  onOpen,
  onAdd,
  slip,
  parlay,
  onGenerate,
  onRemove,
  initialEventId,
}: {
  mode: DashboardMode;
  team?: Team;
  markets: HomeMarket[];
  events: DashboardEvent[];
  loading: boolean;
  error: string;
  onOpen: (m: HomeMarket) => void;
  onAdd: (m: HomeMarket) => void;
  slip: HomeMarket[];
  onRemove: (id: string) => void;
  parlay: ReactNode;
  onGenerate: (setup?: GeneratorSetup) => void;
  initialEventId?: string;
}) {
  const [directory, setDirectory] = useState<DirectoryPlayer[]>([]);
  useEffect(() => {
    if (mode !== 'players') return;
    const c = new AbortController();
    fetch('/api/parlay-lab/players', { signal: c.signal })
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then((b) => {
        if (!c.signal.aborted) setDirectory(b.players ?? []);
      })
      .catch(() => {});
    return () => c.abort();
  }, [mode]);
  const [game, setGame] = useState(initialEventId ?? 'ALL');
  const [columnSort, setColumnSort] = useState<SortState>(null);
  const [category, setCategory] = useState('ALL'),
    [teamFilter, setTeamFilter] = useState('ALL'),
    [player, setPlayer] = useState('ALL'),
    [side, setSide] = useState('ALL'),
    [book, setBook] = useState('ALL'),
    [myTeam, setMyTeam] = useState(false),
    [sort, setSort] = useState('score'),
    [page, setPage] = useState(1);
  const [week, setWeek] = useState('THIS'),
    [railCategory, setRailCategory] = useState('PASSING');
  const [gameMarkets, setGameMarkets] = useState<HomeMarket[]>([]);
  const openEvents = useMemo(
    () =>
      events
        .filter((e) => !e.marketsLocked && Date.parse(e.kickoffAt) > Date.now())
        .sort((a, b) => Date.parse(a.kickoffAt) - Date.parse(b.kickoffAt)),
    [events],
  );
  const router = useRouter();
  const params = useSearchParams();
  const researchContext = useRef<string | undefined>();
  const next = openEvents.find((e) => e.homeTeamId === team?.abbr || e.awayTeamId === team?.abbr);
  useEffect(() => {
    if (mode !== 'games' || !openEvents.length) return;
    const changed = researchContext.current !== team?.abbr;
    const first = researchContext.current === undefined;
    if (changed || !openEvents.some((e) => e.id === game) || game === 'ALL') {
      researchContext.current = team?.abbr;
      const target =
        (first ? openEvents.find((e) => e.id === initialEventId) : undefined) ??
        next ??
        openEvents[0];
      setGame(target.id);
      if (target.week !== openEvents[0]?.week) setWeek('ALL');
    }
  }, [mode, openEvents, next, team?.abbr, initialEventId, game]);
  const changeResearchTeam = (abbr: string) => {
    const query = new URLSearchParams(params?.toString());
    query.set('team', abbr);
    query.delete('game');
    setTeamFilter('ALL');
    setPlayer('ALL');
    setPage(1);
    router.push(`/parlay-lab/games?${query}`, { scroll: false });
  };
  const selected = openEvents.find((e) => e.id === game);
  useEffect(() => {
    setGameMarkets([]);
    if (mode !== 'games' || !selected) return;
    const c = new AbortController();
    fetch(`/api/parlay-lab/events/${encodeURIComponent(selected.id)}/markets`, { signal: c.signal })
      .then((r) => (r.ok ? r.json() : { markets: [] }))
      .then((b) => {
        if (!c.signal.aborted) setGameMarkets(b.markets ?? []);
      })
      .catch(() => {});
    return () => c.abort();
  }, [mode, selected]);
  const unique = useMemo(() => {
    const map = new Map<string, HomeMarket>();
    const ids = new Set(openEvents.map((e) => e.id));
    for (const m of markets) {
      if (!m.available || !m.eventId || !ids.has(m.eventId)) continue;
      const key = `${m.eventId}:${m.normalizedKey}`;
      const old = map.get(key);
      if (!old || (m.odds ?? -9999) > (old.odds ?? -9999)) map.set(key, m);
    }
    return representativeTrends([...map.values()]).sort(
      (a, b) => (b.trend?.trendScore ?? -1) - (a.trend?.trendScore ?? -1),
    );
  }, [markets, openEvents]);
  const categories = [
    ['ALL', 'All Props'],
    ['PASSING', 'Passing'],
    ['RUSHING', 'Rushing'],
    ['RECEIVING', 'Receiving'],
    ['TOUCHDOWN', 'TDs'],
    ['YARDS', 'Yards'],
    ['RECEPTIONS', 'Receptions'],
    ['KICKERS', 'Kickers'],
    ['DEFENSIVE', 'Defensive'],
  ].filter(([id]) => id === 'ALL' || unique.some((m) => matchesCategory(m, id)));
  const rows = useMemo(
    () =>
      unique
        .filter(
          (m) =>
            (game === 'ALL' || m.eventId === game) &&
            matchesCategory(m, category) &&
            (teamFilter === 'ALL' || m.teamId === teamFilter) &&
            (!myTeam || m.teamId === team?.abbr) &&
            (player === 'ALL' || m.playerId === player) &&
            (side === 'ALL' || m.side === side) &&
            (book === 'ALL' || m.sportsbook === book),
        )
        .sort((a, b) =>
          sort === 'name'
            ? (a.playerName ?? '').localeCompare(b.playerName ?? '')
            : sort === 'odds'
              ? (b.odds ?? -9999) - (a.odds ?? -9999)
              : sort === 'trend'
                ? (b.trend?.last10.hitRate ?? -1) - (a.trend?.last10.hitRate ?? -1)
                : (b.trend?.trendScore ?? -1) - (a.trend?.trendScore ?? -1),
        ),
    [unique, game, category, teamFilter, myTeam, team, player, side, book, sort],
  );
  useEffect(() => setPage(1), [game, category, teamFilter, myTeam, player, side, book, sort]);
  const rankedRows = sortTableRows(rows, columnSort, {
    rank: (m) => unique.indexOf(m),
    player: (m) => `${m.playerName ?? ''} ${m.teamId ?? ''}`,
    prop: (m) => label(m),
    game: (m) => {
      const event = openEvents.find((e) => e.id === m.eventId);
      return event ? `${event.awayTeamId} @ ${event.homeTeamId}` : null;
    },
    line: (m) => m.line,
    odds: (m) => (m.odds == null ? null : americanOddsToDecimal(m.odds)),
    score: (m) => m.trend?.trendScore,
    trend: (m) => (m.trend ? compactTrendReason(m) : null),
    last10: (m) => (m.trend?.last10.games ? m.trend.last10.hits / m.trend.last10.games : null),
  });
  const sortColumn = (key: string) => {
    setColumnSort((current) => nextSort(current, key));
    setPage(1);
  };
  const visible = rankedRows.slice(
    (page - 1) * (mode === 'home' ? 5 : 12),
    page * (mode === 'home' ? 5 : 12),
  );
  const players = [
    ...new Map(unique.filter((m) => m.playerId).map((m) => [m.playerId, m])).values(),
  ];
  const teamSuffix = team ? `?team=${team.abbr}` : '';
  const colors = getEditorialHeroTheme(team?.abbr ?? '');
  const stats = [
    ['ACTIVE PROPS', unique.length],
    ['TRENDING NOW', unique.filter((m) => (m.trend?.last10.hitRate ?? 0) >= 70).length],
    ['90+ LAB SCORES', unique.filter((m) => (m.trend?.trendScore ?? 0) >= 90).length],
    ['GAMES ON BOARD', openEvents.length],
  ];
  const currentWeek = openEvents[0]?.week;
  const schedule =
    week === 'ALL'
      ? openEvents
      : openEvents.filter(
          (e) =>
            String(e.week) ===
            (week === 'THIS'
              ? String(currentWeek)
              : week === 'NEXT'
                ? String((currentWeek ?? 0) + 1)
                : week),
        );
  const leaders = (
    mode === 'games'
      ? unique.filter((m) => m.eventId === game)
      : unique.filter((m) => matchesCategory(m, railCategory))
  ).slice(0, 5);
  const filterSelect = (
    title: string,
    value: string,
    set: (s: string) => void,
    options: [string, string][],
  ) => (
    <select aria-label={title} value={value} onChange={(e) => set(e.target.value)}>
      {options.map(([v, t]) => (
        <option key={v} value={v}>
          {t}
        </option>
      ))}
    </select>
  );
  const gameFeature = (
    <div className="lab-game-feature">
      <div>
        <h1 className="lab-display">
          NFL <em>GAMES</em>
        </h1>
        <h3>
          EVERY MATCHUP. EVERY PROP. <mark>DEEPER INSIGHTS.</mark>
        </h3>
        <p>Explore the full NFL slate, compare matchups, and find prop opportunities.</p>
      </div>
      <div>
        {selected ? (
          <>
            <div className="lab-matchup">
              <div>
                <Logo abbr={selected.awayTeamId} />
                <b>{TEAM_LIST.find((t) => t.abbr === selected.awayTeamId)?.name}</b>
              </div>
              <div>
                <b>
                  {selected.awayTeamId} @ {selected.homeTeamId}
                </b>
                <p>{date(selected)}</p>
                {selected.venue && <small>{selected.venue}</small>}
              </div>
              <div>
                <Logo abbr={selected.homeTeamId} />
                <b>{TEAM_LIST.find((t) => t.abbr === selected.homeTeamId)?.name}</b>
              </div>
            </div>
            <div className="lab-market-strip">
              {['SPREAD', 'TOTAL', 'MONEYLINE'].map((type) => {
                const m = gameMarkets.find(
                  (m) => m.available && !m.playerId && m.marketType === type,
                );
                return (
                  <span key={type}>
                    <small>{type}</small>
                    <b>
                      {m
                        ? type === 'MONEYLINE'
                          ? `${m.teamId ?? m.side} ${odds(m.odds)}`
                          : pick(m)
                        : '—'}
                    </b>
                  </span>
                );
              })}
            </div>
          </>
        ) : (
          <p className="lab-empty">No upcoming games available.</p>
        )}
      </div>
    </div>
  );
  const heroPlayers = new Set<string>();
  const topHeroProps = unique
    .filter(
      (m) =>
        m.playerId &&
        m.playerName &&
        m.trend &&
        Number.isFinite(m.trend.trendScore) &&
        m.trend.trendScore >= 0 &&
        m.trend.trendScore <= 100,
    )
    .filter((m) => {
      const player = m.playerId!;
      if (heroPlayers.has(player)) return false;
      heroPlayers.add(player);
      return true;
    })
    .slice(0, 3);
  const spotlight = (
    <section className="lab-spotlight lab-panel">
      <div>
        <h1 className="lab-display">
          TRENDING <em>PROPS</em>
        </h1>
        <h3>
          REAL DATA. REAL TRENDS. <mark>BET SMARTER.</mark>
        </h3>
        <p>Explore NFL props using stored statistics, matchup context, and existing Lab Scores.</p>
      </div>
      <div className="lab-spotlight-cards" aria-label="Top props by Lab Score">
        {topHeroProps.map((market, index) => (
          <button
            key={`${market.eventId}:${market.id}:${market.sportsbook}`}
            className="lab-spotlight-prop"
            onClick={() => onOpen(market)}
          >
            <small>#{index + 1} LAB SCORE</small>
            <PlayerAvatar
              name={market.playerName}
              headshotUrl={market.headshotUrl}
              size={64}
              transparent
            />
            <b>{market.playerName}</b>
            <small>
              {market.teamId}
              {market.position ? ` · ${market.position}` : ''}
            </small>
            <span>
              {pick(market)} {label(market)}
            </span>
            <Score value={market.trend!.trendScore} />
            <span>View Prop →</span>
          </button>
        ))}
      </div>
    </section>
  );
  const propsTable = (
    <section className="lab-panel lab-props">
      <header>
        <h2>
          <LabTrendsIcon />
          {mode === 'games' ? 'Game Props' : 'Trending Props'}
        </h2>
        {mode === 'home' && <Link href={`/parlay-lab/trends${teamSuffix}`}>View All →</Link>}
      </header>
      <div className="lab-tabs">
        {categories.map(([id, name]) => (
          <button key={id} aria-pressed={category === id} onClick={() => setCategory(id)}>
            {name}
          </button>
        ))}
      </div>
      <div className="lab-filters">
        {mode !== 'games' &&
          filterSelect('Game', game, setGame, [
            ['ALL', 'All Games'],
            ...openEvents.map(
              (e) => [e.id, `${e.awayTeamId} @ ${e.homeTeamId}`] as [string, string],
            ),
          ])}
        {filterSelect('Team', teamFilter, setTeamFilter, [
          ['ALL', 'All Teams'],
          ...TEAM_LIST.map((t) => [t.abbr, t.name] as [string, string]),
        ])}
        {mode !== 'home' &&
          filterSelect('Player', player, setPlayer, [
            ['ALL', 'All Players'],
            ...players.map((m) => [m.playerId!, m.playerName!] as [string, string]),
          ])}
        {filterSelect('Over / Under', side, setSide, [
          ['ALL', 'Over / Under'],
          ['OVER', 'Over'],
          ['UNDER', 'Under'],
        ])}
        {filterSelect('Sportsbook', book, setBook, [
          ['ALL', 'All Sportsbooks'],
          ...[...new Set(unique.map((m) => m.sportsbook))].map(
            (b) => [b, sportsbookName(b)] as [string, string],
          ),
        ])}
        {filterSelect(
          'Sort props',
          columnSort ? '' : sort,
          (value) => {
            setSort(value);
            setColumnSort(null);
          },
          [
            ...(columnSort ? [['', 'Column sort'] as [string, string]] : []),
            ['score', 'Lab Score'],
            ['trend', 'L10 Hit Rate'],
            ['name', 'Player'],
            ['odds', 'Odds'],
          ],
        )}
        <label>
          <input type="checkbox" checked={myTeam} onChange={(e) => setMyTeam(e.target.checked)} />{' '}
          My Team Only
        </label>
      </div>
      <div className="lab-table-scroll">
        <table>
          <thead>
            <tr>
              <ParlaySortHeader
                as="th"
                label="#"
                sortKey="rank"
                sort={columnSort}
                onSort={sortColumn}
              />
              <ParlaySortHeader
                as="th"
                label="Player / Team"
                sortKey="player"
                sort={columnSort}
                onSort={sortColumn}
              />
              <ParlaySortHeader
                as="th"
                label="Prop"
                sortKey="prop"
                sort={columnSort}
                onSort={sortColumn}
              />
              <ParlaySortHeader
                as="th"
                label="Game"
                sortKey="game"
                sort={columnSort}
                onSort={sortColumn}
              />
              <ParlaySortHeader
                as="th"
                label="Line"
                sortKey="line"
                sort={columnSort}
                onSort={sortColumn}
              />
              <ParlaySortHeader
                as="th"
                label="Odds"
                sortKey="odds"
                sort={columnSort}
                onSort={sortColumn}
              />
              <ParlaySortHeader
                as="th"
                label="Lab Score"
                sortKey="score"
                sort={columnSort}
                onSort={sortColumn}
              />
              {mode !== 'home' && (
                <ParlaySortHeader
                  as="th"
                  label="Trend"
                  sortKey="trend"
                  sort={columnSort}
                  onSort={sortColumn}
                />
              )}
              <ParlaySortHeader
                as="th"
                label="L10"
                sortKey="last10"
                sort={columnSort}
                onSort={sortColumn}
              />
              <th>Add</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((m, i) => (
              <tr key={`${m.id}:${m.sportsbook}`}>
                <td>{unique.indexOf(m) + 1}</td>
                <td>
                  <button className="lab-player" onClick={() => onOpen(m)}>
                    <PlayerAvatar
                      name={m.playerName}
                      headshotUrl={m.headshotUrl}
                      transparent
                      size={32}
                    />
                    <span>
                      <b>{m.playerName ?? m.teamId}</b>
                      <small>
                        {m.teamId} · {m.position}
                      </small>
                    </span>
                  </button>
                </td>
                <td>
                  <button onClick={() => onOpen(m)}>
                    {mode === 'home' ? `${pick(m)} ${label(m)}` : label(m)}
                  </button>
                </td>
                <td>
                  {(() => {
                    const e = openEvents.find((e) => e.id === m.eventId);
                    return e ? `${e.awayTeamId} @ ${e.homeTeamId}` : '—';
                  })()}
                </td>
                <td>{pick(m)}</td>
                <td>{odds(m.odds)}</td>
                <td>
                  <Score value={m.trend?.trendScore} />
                </td>
                {mode !== 'home' && <td className="lab-trend">{compactTrendReason(m)}</td>}
                <td>
                  {m.trend?.last10.games ? `${m.trend.last10.hits}/${m.trend.last10.games}` : '—'}
                </td>
                <td>
                  <button
                    className="lab-add"
                    aria-label={`Add ${m.playerName ?? 'market'} to parlay`}
                    disabled={slip.some((s) => s.id === m.id && s.sportsbook === m.sportsbook)}
                    onClick={() => onAdd(m)}
                  >
                    <Plus />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!visible.length && (
        <p className="lab-empty">
          {loading ? 'Loading saved props…' : error || 'No available props match these filters.'}
        </p>
      )}
      {mode !== 'home' && rows.length > 12 && (
        <div className="lab-pagination">
          <button disabled={page <= 1} onClick={() => setPage(page - 1)}>
            Previous
          </button>
          <span>
            Page {page} of {Math.ceil(rows.length / 12)}
          </span>
          <button disabled={page * 12 >= rows.length} onClick={() => setPage(page + 1)}>
            Next
          </button>
        </div>
      )}
    </section>
  );
  const rail = (
    <aside className="lab-right-rail">
      {mode !== 'home' && (
        <Panel
          title={mode === 'games' ? 'Game Insights' : 'Quick Insights'}
          icon={<LabInsightsIcon />}
        >
          <ul className="lab-insights">
            <li>
              {(mode === 'games' ? unique.filter((m) => m.eventId === game) : unique).length}{' '}
              available research props.
            </li>
            <li>
              {
                (mode === 'games' ? unique.filter((m) => m.eventId === game) : unique).filter(
                  (m) => (m.trend?.trendScore ?? 0) >= 90,
                ).length
              }{' '}
              props have a Lab Score of 90 or higher.
            </li>
          </ul>
        </Panel>
      )}
      {mode !== 'home' && (
        <Panel
          title={mode === 'games' ? 'Top Props in This Game' : 'Top Trending by Category'}
          icon={<LabTrendsIcon />}
        >
          {mode !== 'games' && (
            <div className="lab-tabs lab-subtle-tabs">
              {categories
                .filter(([id]) => id !== 'ALL')
                .map(([id, name]) => (
                  <button
                    key={id}
                    aria-pressed={railCategory === id}
                    onClick={() => setRailCategory(id)}
                  >
                    {name}
                  </button>
                ))}
            </div>
          )}
          <div className="lab-leaders">
            {leaders.map((m, i) => (
              <button key={`${m.id}:${m.sportsbook}`} onClick={() => onOpen(m)}>
                <span>{i + 1}</span>
                <PlayerAvatar name={m.playerName} headshotUrl={m.headshotUrl} transparent />
                <span>
                  {m.playerName}
                  <small>
                    {label(m)} · {pick(m)}
                  </small>
                </span>
                <Score value={m.trend?.trendScore} />
              </button>
            ))}
            {!leaders.length && <p className="lab-empty">No scored props available.</p>}
          </div>
        </Panel>
      )}
      <div>
        {parlay}
        <button className="lab-primary lab-create" onClick={() => onGenerate()}>
          <LabExperimentIcon /> Create a Parlay
        </button>
      </div>
      {mode === 'home' && team && (
        <Panel title="Next Game" icon={<DdGameCenterIcon />}>
          <NextGameHeroCard teamId={team.abbr} />
        </Panel>
      )}
      {mode === 'trends' ? <Movement alerts markets={unique} onOpen={onOpen} /> : <LabScoreGuide />}
    </aside>
  );
  let simple: ReactNode = null;
  if (mode === 'players')
    return (
      <PlayersDashboard
        team={team}
        markets={markets}
        events={openEvents}
        roster={directory}
        loading={loading}
        error={error}
        slip={slip}
        onOpen={onOpen}
        onRemove={onRemove}
        onGenerate={() => onGenerate()}
      />
    );
  if (mode === 'teams')
    simple = (
      <div className="lab-team-grid">
        {TEAM_LIST.map((t) => (
          <Link key={t.abbr} href={`/parlay-lab?team=${t.abbr}`}>
            <Logo abbr={t.abbr} />
            <b>{t.name}</b>
            <small>
              {unique.filter((m) => m.teamId === t.abbr).length} available research props
            </small>
          </Link>
        ))}
      </div>
    );
  if (mode === 'generator')
    return (
      <GeneratorDashboard
        team={team}
        markets={markets}
        events={events}
        loading={loading}
        error={error}
        slip={slip}
        onAdd={onAdd}
        onRemove={onRemove}
        onOpen={onOpen}
      />
    );
  if (mode === 'settings')
    simple = (
      <Panel title="Your Parlay Lab preferences">
        <p className="lab-empty">
          Your selected team personalizes highlights. NFL-wide research remains available on every
          page.
        </p>
        <Link className="lab-primary" href={`/parlay-lab/teams${teamSuffix}`}>
          Change team
        </Link>
      </Panel>
    );
  return (
    <div
      className="lab-dashboard"
      data-mode={mode}
      style={
        {
          '--lab-accent': colors.heroPrimaryAccent,
          '--lab-bright': colors.heroBrightAccent,
        } as React.CSSProperties
      }
    >
      {simple ? (
        <>
          <h1 className="lab-display">{mode.toUpperCase()}</h1>
          {simple}
        </>
      ) : (
        <>
          <div className="lab-center">
            {mode !== 'trends' && (
              <div className="lab-kpis">
                {(mode === 'games'
                  ? [
                      ['GAMES THIS WEEK', openEvents.filter((e) => e.week === currentWeek).length],
                      ['TOTAL PROPS', unique.length],
                      [
                        'STRONG LAB SIGNALS',
                        unique.filter((m) => (m.trend?.trendScore ?? 0) >= 90).length,
                      ],
                      [
                        'PRIMETIME GAMES',
                        openEvents.filter((e) => {
                          const h = Number(
                            new Intl.DateTimeFormat('en-US', {
                              timeZone: 'America/New_York',
                              hour: 'numeric',
                              hourCycle: 'h23',
                            }).format(new Date(e.kickoffAt)),
                          );
                          return e.week === currentWeek && h >= 19;
                        }).length,
                      ],
                    ]
                  : stats
                ).map(([name, value]) => (
                  <div key={name}>
                    <b>{loading ? '—' : value}</b>
                    <small>{name}</small>
                  </div>
                ))}
                {mode === 'games' ? (
                  <div className="lab-research-team">
                    {team && <Logo abbr={team.abbr} />}
                    <select
                      aria-label="Research team"
                      value={team?.abbr ?? ''}
                      onChange={(e) => changeResearchTeam(e.target.value)}
                    >
                      {TEAM_LIST.map((t) => (
                        <option key={t.abbr} value={t.abbr}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  next && (
                    <Link
                      className="lab-next"
                      href={`/parlay-lab/games?team=${team?.abbr ?? ''}&game=${next.id}`}
                    >
                      <Logo abbr={next.awayTeamId} />
                      <span>
                        {next.awayTeamId} @ {next.homeTeamId}
                        <small>{date(next)}</small>
                      </span>
                      <Logo abbr={next.homeTeamId} />
                    </Link>
                  )
                )}
              </div>
            )}
            {mode === 'home' ? (
              <div className="lab-feature">
                <ParlayLabHero
                  teamAbbr={team?.abbr ?? ''}
                  markets={markets}
                  events={events}
                  onOpen={onOpen}
                  dashboard
                />
              </div>
            ) : mode === 'games' ? (
              <section className="lab-panel">{gameFeature}</section>
            ) : (
              spotlight
            )}
            <div
              className={
                mode === 'home' ? 'lab-home-bottom' : mode === 'games' ? 'lab-game-bottom' : ''
              }
            >
              {mode === 'games' && (
                <Panel title="NFL Schedule" icon={<DdGameCenterIcon />}>
                  <div className="lab-tabs">
                    {['THIS', 'NEXT', 'ALL'].map((v) => (
                      <button key={v} aria-pressed={week === v} onClick={() => setWeek(v)}>
                        {v === 'THIS' ? 'This Week' : v === 'NEXT' ? 'Next Week' : 'All Games'}
                      </button>
                    ))}
                  </div>
                  <div className="lab-schedule">
                    {schedule.map((e, i) => {
                      const day = new Date(e.kickoffAt).toLocaleDateString('en-US', {
                        weekday: 'long',
                        month: 'short',
                        day: 'numeric',
                      });
                      return (
                        <div key={e.id}>
                          {(i === 0 ||
                            new Date(schedule[i - 1].kickoffAt).toDateString() !==
                              new Date(e.kickoffAt).toDateString()) && <h3>{day}</h3>}
                          <button aria-pressed={game === e.id} onClick={() => setGame(e.id)}>
                            <Logo abbr={e.awayTeamId} />
                            <span>
                              <b>
                                {e.awayTeamId} @ {e.homeTeamId}
                              </b>
                              <small>
                                {new Date(e.kickoffAt).toLocaleTimeString('en-US', {
                                  hour: 'numeric',
                                  minute: '2-digit',
                                })}
                              </small>
                              <small>
                                {unique.filter((m) => m.eventId === e.id).length} props ·{' '}
                                {
                                  unique.filter(
                                    (m) => m.eventId === e.id && (m.trend?.trendScore ?? 0) >= 90,
                                  ).length
                                }{' '}
                                signals
                              </small>
                            </span>
                            <Logo abbr={e.homeTeamId} />
                          </button>
                        </div>
                      );
                    })}
                    {!schedule.length && (
                      <p className="lab-empty">No saved upcoming games for this week.</p>
                    )}
                  </div>
                </Panel>
              )}
              {propsTable}
              {mode === 'home' && <Movement markets={unique} onOpen={onOpen} />}
            </div>
          </div>
          {rail}
        </>
      )}
    </div>
  );
}
