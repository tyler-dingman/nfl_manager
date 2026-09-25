'use client';
import { marketDisplayName } from '@/lib/parlay-lab/market-display';
import { useMemo, useState, type CSSProperties } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { TEAM_LIST } from '@/data/teams';
import type { Team } from '@/features/team/team-store';
import { getEditorialHeroTheme } from '@/lib/team-theme-tokens';
import { DdPlayerComparisonIcon } from '@/components/ui/football-icons';
import { LabExperimentIcon, LabInsightsIcon, LabTrendsIcon } from './lab-icons';
import PlayerAvatar from './PlayerAvatar';
import type { HomeMarket } from './ParlayLabHome';
import type { DashboardEvent } from './dashboard-content';
import {
  summarizePlayers,
  rankPlayers,
  playerStatus,
  type DirectoryPlayer,
  type PlayerSummary,
} from './player-directory-data';
import styles from './players-dashboard.module.css';
import ParlaySortHeader from './ParlaySortHeader';
import { nextSort, sortTableRows, type SortState } from './parlay-table';
const rate = (n: number | null) => (n == null ? '—' : `${Math.round(n)}%`);
function Score({ value }: { value: number | null }) {
  return (
    <strong
      className="lab-score"
      data-tier={value == null ? 'none' : value >= 70 ? 'good' : value >= 50 ? 'mid' : 'low'}
    >
      {value == null ? '—' : Math.round(value)}
    </strong>
  );
}
function Trend({ value }: { value: number | null }) {
  return (
    <span
      className={
        value == null || value === 0
          ? styles.neutral
          : value > 0
            ? styles.positive
            : styles.negative
      }
      title="Percentage-point change: last 5 vs previous 5 games"
    >
      {value == null
        ? '—'
        : value === 0
          ? '→'
          : `${value > 0 ? '↑ +' : '↓ '}${Math.round(value)} pp`}
    </span>
  );
}
function TeamLogo({ abbr }: { abbr: string }) {
  const t = TEAM_LIST.find((t) => t.abbr === abbr);
  return t ? <Image src={t.logoUrl} width={38} height={30} unoptimized alt={abbr} /> : null;
}
export function PlayersDashboard({
  team,
  markets,
  events,
  roster,
  loading,
  error,
  slip,
  onOpen,
  onRemove,
  onGenerate,
}: {
  team?: Team;
  markets: HomeMarket[];
  events: DashboardEvent[];
  roster: DirectoryPlayer[];
  loading: boolean;
  error?: string | null;
  slip: HomeMarket[];
  onOpen: (m: HomeMarket) => void;
  onRemove: (id: string) => void;
  onGenerate: () => void;
}) {
  const [search, setSearch] = useState(''),
    [teamFilter, setTeamFilter] = useState('ALL'),
    [position, setPosition] = useState('ALL'),
    [myTeam, setMyTeam] = useState(false),
    [sort, setSort] = useState('Overall Rating'),
    [week, setWeek] = useState('ALL'),
    [limit, setLimit] = useState(25);
  const [columnSort, setColumnSort] = useState<SortState>(null);
  const colors = getEditorialHeroTheme(team?.abbr);
  const weeks = [
    ...new Set(events.filter((e) => e.week != null).map((e) => `${e.season ?? ''}:${e.week}`)),
  ].sort();
  const scoped = useMemo(() => {
    const active = markets.filter(
      (m) =>
        m.available &&
        events.some(
          (e) => e.id === m.eventId && (week === 'ALL' || `${e.season ?? ''}:${e.week}` === week),
        ),
    );
    return [...new Map(active.map((m) => [`${m.eventId}:${m.normalizedKey || m.id}`, m])).values()];
  }, [markets, events, week]);
  const players = useMemo(
    () => summarizePlayers(scoped, roster).sort(rankPlayers),
    [scoped, roster],
  );
  const featured: PlayerSummary[] = [];
  const qualified = players.filter((p) => playerStatus(p));
  for (const p of qualified)
    if (featured.length < 3 && !featured.some((x) => x.teamAbbr === p.teamAbbr)) featured.push(p);
  for (const p of qualified) if (featured.length < 3 && !featured.includes(p)) featured.push(p);
  const filteredPlayers = players
    .filter(
      (p) =>
        p.name.toLowerCase().includes(search.trim().toLowerCase()) &&
        (teamFilter === 'ALL' || p.teamAbbr === teamFilter) &&
        (position === 'ALL' || p.position === position) &&
        (!myTeam || p.teamAbbr === team?.abbr),
    )
    .sort((a, b) =>
      sort === 'Name'
        ? a.name.localeCompare(b.name)
        : sort === 'Lab Score'
          ? (b.score ?? -1) - (a.score ?? -1) || rankPlayers(a, b)
          : sort === 'Trending'
            ? (b.change ?? -101) - (a.change ?? -101) || rankPlayers(a, b)
            : rankPlayers(a, b),
    );
  const rows = sortTableRows(filteredPlayers, columnSort, {
    rank: (p) => players.indexOf(p),
    player: (p) => p.name,
    team: (p) => p.teamAbbr,
    position: (p) => p.position,
    games: (p) => p.games || null,
    hitRate: (p) => p.hitRate,
    trend: (p) => p.change,
    score: (p) => p.score,
  });
  const sortColumn = (key: string) => {
    setColumnSort((current) => nextSort(current, key));
    setLimit(25);
  };
  const hot = players.filter((p) => p.recentRate != null && p.recentRate >= 80).length,
    qbs = players.filter((p) => p.position === 'QB' && (p.score ?? 0) >= 90).length,
    improving = players.filter((p) => (p.change ?? 0) >= 10).length;
  const findings = [
    hot ? `${hot} players have an 80%+ aggregate hit rate over their last 5 games.` : null,
    qbs ? `${qbs} QBs have a current Lab Score of 90 or higher.` : null,
    improving
      ? `${improving} players improved by at least 10 percentage points over their previous 5 games.`
      : null,
  ].filter(Boolean);
  const reset = () => setLimit(25);
  return (
    <div
      className={`lab-dashboard ${styles.dashboard}`}
      data-mode="players"
      style={
        {
          '--lab-accent': colors.heroPrimaryAccent,
          '--lab-bright': colors.heroBrightAccent,
        } as CSSProperties
      }
    >
      <main className="lab-center">
        <div className="lab-kpis">
          {[
            [players.length, 'PLAYERS'],
            [new Set(players.map((p) => p.teamAbbr)).size, 'TEAMS'],
            [scoped.length, 'ACTIVE PROPS'],
            [players.filter((p) => (p.score ?? 0) >= 90).length, '90+ PLAYER LAB SCORES'],
          ].map(([n, label]) => (
            <div key={label}>
              <b>{Number(n).toLocaleString()}</b>
              <small>{label}</small>
            </div>
          ))}
          <select
            aria-label="Player research week"
            value={week}
            onChange={(e) => {
              setWeek(e.target.value);
              reset();
            }}
          >
            <option value="ALL">All upcoming weeks</option>
            {weeks.map((w) => (
              <option key={w} value={w}>
                Week {w.split(':')[1]}
                {w.split(':')[0] ? ` · ${w.split(':')[0]}` : ''}
              </option>
            ))}
          </select>
        </div>
        <section className={styles.hero} aria-label="Player discovery">
          <div className={styles.intro}>
            <h1 className="lab-display">PLAYERS</h1>
            <h2>
              REAL DATA. REAL TRENDS. <em>BET SMARTER.</em>
            </h2>
            <p>
              Search for any player to explore trends, matchup data, splits, and all available prop
              markets.
            </p>
          </div>
          <div className={styles.features}>
            {featured.map((p) => {
              const status = playerStatus(p)!;
              return (
                <article key={p.id} className={styles.feature}>
                  <div className={styles.portrait}>
                    <PlayerAvatar name={p.name} headshotUrl={p.headshotUrl} size={72} transparent />
                    <TeamLogo abbr={p.teamAbbr} />
                  </div>
                  <h3>{p.name}</h3>
                  <small>
                    {p.position} · {p.teamAbbr}
                  </small>
                  <h4 data-status={status.kind}>
                    {status.kind === 'hot' ? '♨' : status.kind === 'up' ? '↗' : '☆'} {status.label}
                  </h4>
                  <p>{status.text}</p>
                  <button onClick={() => onOpen(p.market)}>View Player →</button>
                </article>
              );
            })}
          </div>
        </section>
        <div className={styles.filters}>
          <input
            aria-label="Search players"
            placeholder="Search players (e.g. Patrick Mahomes)"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              reset();
            }}
          />
          <select
            aria-label="Team"
            value={teamFilter}
            onChange={(e) => {
              setTeamFilter(e.target.value);
              reset();
            }}
          >
            <option value="ALL">All Teams</option>
            {TEAM_LIST.map((t) => (
              <option key={t.abbr} value={t.abbr}>
                {t.name}
              </option>
            ))}
          </select>
          <select
            aria-label="Position"
            value={position}
            onChange={(e) => {
              setPosition(e.target.value);
              reset();
            }}
          >
            <option value="ALL">All Positions</option>
            {[...new Set(players.map((p) => p.position))].sort().map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
          <label>
            <input
              type="checkbox"
              checked={myTeam}
              disabled={!team}
              onChange={(e) => {
                setMyTeam(e.target.checked);
                reset();
              }}
            />{' '}
            My Team Only
          </label>
        </div>
        <section className={`lab-panel ${styles.directory}`} id="player-directory">
          <header>
            <h2>
              <DdPlayerComparisonIcon />
              Player Directory
            </h2>
            <label title="Overall Rating sorts by recent hit rate, then improvement, then strongest current Lab Score.">
              Sort by:{' '}
              <select
                aria-label="Sort players"
                value={columnSort ? '' : sort}
                onChange={(e) => {
                  setSort(e.target.value);
                  setColumnSort(null);
                }}
              >
                {columnSort && <option value="">Column sort</option>}
                {['Overall Rating', 'Hit Rate', 'Trending', 'Lab Score', 'Name'].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
          </header>
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
                  label="PLAYER"
                  sortKey="player"
                  sort={columnSort}
                  onSort={sortColumn}
                />
                <ParlaySortHeader
                  as="th"
                  label="TEAM"
                  sortKey="team"
                  sort={columnSort}
                  onSort={sortColumn}
                />
                <ParlaySortHeader
                  as="th"
                  label="POS"
                  sortKey="position"
                  sort={columnSort}
                  onSort={sortColumn}
                />
                <ParlaySortHeader
                  as="th"
                  label="GAMES"
                  sortKey="games"
                  sort={columnSort}
                  onSort={sortColumn}
                />
                <ParlaySortHeader
                  as="th"
                  label="HIT RATE"
                  sortKey="hitRate"
                  sort={columnSort}
                  onSort={sortColumn}
                />
                <ParlaySortHeader
                  as="th"
                  label="TREND"
                  sortKey="trend"
                  sort={columnSort}
                  onSort={sortColumn}
                />
                <ParlaySortHeader
                  as="th"
                  label="LAB SCORE"
                  sortKey="score"
                  sort={columnSort}
                  onSort={sortColumn}
                />
                <th>ACTION</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, limit).map((p, i) => (
                <tr key={p.id} onClick={() => onOpen(p.market)}>
                  <td>{players.indexOf(p) + 1}</td>
                  <td>
                    <button
                      className={styles.player}
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpen(p.market);
                      }}
                    >
                      <PlayerAvatar name={p.name} headshotUrl={p.headshotUrl} transparent />
                      <span>
                        {p.name}
                        <small>
                          {p.teamAbbr} · {p.position}
                        </small>
                      </span>
                    </button>
                  </td>
                  <td>
                    <span className={styles.team}>
                      <TeamLogo abbr={p.teamAbbr} />
                      {p.teamAbbr}
                    </span>
                  </td>
                  <td>{p.position}</td>
                  <td>{p.games || '—'}</td>
                  <td
                    className={
                      p.hitRate != null && p.hitRate >= 80 ? styles.positive : styles.neutral
                    }
                  >
                    {rate(p.hitRate)}
                  </td>
                  <td>
                    <Trend value={p.change} />
                  </td>
                  <td>
                    <Score value={p.score} />
                  </td>
                  <td>
                    <button
                      className={styles.view}
                      aria-label={`View ${p.name}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpen(p.market);
                      }}
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!rows.length && (
            <p className="lab-empty">
              {loading
                ? 'Loading player research…'
                : error || 'No researchable players match these filters.'}
            </p>
          )}
          {rows.length > limit && (
            <button className={styles.more} onClick={() => setLimit((n) => n + 25)}>
              Load more players →
            </button>
          )}
          <p className={styles.help}>
            Recent hit rate across qualifying tracked player props: up to 10 games tested against
            current main/standard Over lines, excluding pushes. Trend compares the last 5 with the
            previous 5 games. Historical results are not win probabilities.
          </p>
        </section>
      </main>
      <aside className="lab-right-rail">
        <section className={`lab-panel ${styles.slip}`}>
          <header>
            <h2>
              <LabExperimentIcon />
              My Parlay <span>{slip.length}</span>
            </h2>
          </header>
          {slip.length ? (
            <>
              <div>
                {slip.slice(0, 4).map((m) => (
                  <div className={styles.leg} key={m.id}>
                    <PlayerAvatar name={m.playerName} headshotUrl={m.headshotUrl} transparent />
                    <button onClick={() => onOpen(m)}>
                      {m.playerName}
                      <small>
                        {m.side} {m.line}{' '}
                        {marketDisplayName(m.marketType === 'OTHER' ? m.statId : m.marketType)}
                      </small>
                    </button>
                    <button aria-label={`Remove ${m.playerName}`} onClick={() => onRemove(m.id)}>
                      ⊖
                    </button>
                  </div>
                ))}
              </div>
              <Link
                className="lab-primary"
                href={`/parlay-lab/my-plays${team ? `?team=${team.abbr}` : ''}`}
              >
                View My Parlay{slip.length > 4 ? ` (${slip.length})` : ''} →
              </Link>
            </>
          ) : (
            <div className={styles.empty}>
              <span>＋</span>
              <b>Build your parlay</b>
              <button className="lab-primary" onClick={onGenerate}>
                Create a Parlay →
              </button>
            </div>
          )}
        </section>
        <section className="lab-panel">
          <header>
            <h2>
              <LabInsightsIcon />
              Lab Finds
            </h2>
          </header>
          {findings.length ? (
            findings.map((f) => (
              <p key={f} className={styles.finding}>
                <LabTrendsIcon />
                {f}
              </p>
            ))
          ) : (
            <p className="lab-empty">More qualifying history is needed for player findings.</p>
          )}
        </section>
        <section className="lab-panel">
          <header>
            <h2>
              <LabTrendsIcon />
              Top Players Right Now
            </h2>
          </header>
          {players.slice(0, 5).map((p, i) => (
            <button key={p.id} className={styles.top} onClick={() => onOpen(p.market)}>
              <span>{i + 1}</span>
              <PlayerAvatar name={p.name} headshotUrl={p.headshotUrl} transparent />
              <b>{p.name}</b>
              <span>{rate(p.hitRate)}</span>
              <Score value={p.score} />
            </button>
          ))}
          <a
            className={styles.more}
            href="#player-directory"
            onClick={() => {
              setSearch('');
              setTeamFilter('ALL');
              setPosition('ALL');
              setMyTeam(false);
              setSort('Overall Rating');
            }}
          >
            View All Players →
          </a>
        </section>
      </aside>
    </div>
  );
}
