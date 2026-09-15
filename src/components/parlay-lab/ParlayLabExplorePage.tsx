'use client';

import Link from 'next/link';
import { ChevronLeft, ChevronRight, FlaskConical } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import MainSiteHeader from '@/components/main-site-header';
import { sportsbookName } from '@/server/odds/sportsbooks';
import type { Market } from './ParlayLabPage';
import ParlayLabSecondaryNav from './ParlayLabSecondaryNav';
import PlayerAvatar from './PlayerAvatar';
import ParlaySortHeader from './ParlaySortHeader';
import { isLabPickMarket } from './trending-market-filter';
import {
  americanOddsToDecimal,
  compareAmericanOdds,
  hitRateSortValue,
  matchesOddsFilter,
  nextSort,
  sortTableRows,
  type OddsFilter,
  type SortState,
} from './parlay-table';
import styles from './parlay-explore-page.module.css';

type Event = {
  id: string;
  week: number;
  homeTeamId: string;
  awayTeamId: string;
  kickoffAt: string;
  marketsLocked: boolean;
};
type ResearchMarket = Market & {
  eventId?: string;
  trend?: {
    last10: { games: number; hits: number; hitRate: number | null };
    vsOpponent: { games: number; hits: number };
    average: number | null;
    trendScore: number;
  } | null;
};
type Mode = 'games' | 'trends' | 'lab-finds';
type ResearchSortKey =
  | 'player'
  | 'game'
  | 'market'
  | 'last10'
  | 'hitRate'
  | 'average'
  | 'opponent'
  | 'book'
  | 'odds'
  | 'score';
const PAGE_SIZE = 20;
const humanize = (value: string) =>
  value
    .replaceAll('_', ' ')
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
const marketName = (market: ResearchMarket) =>
  humanize(market.marketType === 'OTHER' ? market.statId : market.marketType);
const selection = (market: ResearchMarket) =>
  `${market.side === 'OVER' ? 'O' : market.side === 'UNDER' ? 'U' : market.side} ${market.line ?? ''}`.trim();
const odds = (value: number | null) => (value === null ? '—' : `${value > 0 ? '+' : ''}${value}`);

export default function ParlayLabExplorePage({ mode }: { mode: Mode }) {
  const [events, setEvents] = useState<Event[]>([]);
  const [markets, setMarkets] = useState<ResearchMarket[]>([]);
  const [gameId, setGameId] = useState('ALL');
  const [book, setBook] = useState('ALL');
  const [oddsFilter, setOddsFilter] = useState<OddsFilter>('ALL');
  const [oddsMinimum, setOddsMinimum] = useState<number | null>(null);
  const [oddsMaximum, setOddsMaximum] = useState<number | null>(null);
  const [sort, setSort] = useState<SortState<ResearchSortKey>>(null);
  const [urlReady, setUrlReady] = useState(false);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void fetch('/api/parlay-lab/events')
      .then((response) => response.json())
      .then((body) => setEvents(body.events ?? []));
  }, []);
  useEffect(() => {
    if (mode === 'games') {
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    void fetch(`/api/parlay-lab/research?eventId=${encodeURIComponent(gameId)}`, {
      signal: controller.signal,
    })
      .then((response) => response.json())
      .then((body) => setMarkets(body.markets ?? []))
      .catch((error: unknown) => {
        if ((error as { name?: string } | null)?.name === 'AbortError') return;
        console.error('[parlay-lab] failed to load research markets', error);
        setMarkets([]);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [gameId, mode]);
  useEffect(() => setPage(1), [gameId, mode]);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setGameId(params.get('game') ?? 'ALL');
    setBook(params.get('book') ?? 'ALL');
    setOddsFilter((params.get('odds') as OddsFilter | null) ?? 'ALL');
    setOddsMinimum(params.get('oddsMin') ? Number(params.get('oddsMin')) : null);
    setOddsMaximum(params.get('oddsMax') ? Number(params.get('oddsMax')) : null);
    const sortKey = params.get('sort') as ResearchSortKey | null;
    const direction = params.get('direction');
    if (sortKey && (direction === 'asc' || direction === 'desc'))
      setSort({ key: sortKey, direction });
    setUrlReady(true);
  }, []);
  useEffect(() => {
    if (mode === 'games' || !urlReady) return;
    const params = new URLSearchParams();
    if (gameId !== 'ALL') params.set('game', gameId);
    if (book !== 'ALL') params.set('book', book);
    if (oddsFilter !== 'ALL') params.set('odds', oddsFilter);
    if (oddsFilter === 'CUSTOM' && oddsMinimum != null) params.set('oddsMin', String(oddsMinimum));
    if (oddsFilter === 'CUSTOM' && oddsMaximum != null) params.set('oddsMax', String(oddsMaximum));
    if (sort) {
      params.set('sort', sort.key);
      params.set('direction', sort.direction);
    }
    window.history.replaceState(
      null,
      '',
      `${window.location.pathname}${params.size ? `?${params}` : ''}`,
    );
  }, [book, gameId, mode, oddsFilter, oddsMaximum, oddsMinimum, sort, urlReady]);
  useEffect(() => setPage(1), [book, oddsFilter, oddsMinimum, oddsMaximum, sort]);

  const eventById = useMemo(() => new Map(events.map((event) => [event.id, event])), [events]);
  const rows = useMemo(() => {
    const unique = new Map<string, ResearchMarket>();
    markets
      .filter(
        (market) =>
          market.available &&
          (mode !== 'lab-finds' || isLabPickMarket(market)) &&
          (book === 'ALL' || market.sportsbook === book) &&
          matchesOddsFilter(market.odds, oddsFilter, oddsMinimum, oddsMaximum),
      )
      .forEach((market) => {
        const key = `${market.eventId ?? gameId}:${market.normalizedKey}`;
        const previous = unique.get(key);
        if (
          !previous ||
          (market.odds != null &&
            (previous.odds == null || compareAmericanOdds(market.odds, previous.odds) > 0))
        )
          unique.set(key, market);
      });
    const filtered = [...unique.values()];
    if (sort)
      return sortTableRows(filtered, sort, {
        player: (market) => (market.playerName ?? market.teamId ?? '').toLowerCase(),
        game: (market) => {
          const event = eventById.get(market.eventId ?? gameId);
          return event ? `${event.awayTeamId} ${event.homeTeamId}` : '';
        },
        market: (market) => marketName(market).toLowerCase(),
        last10: (market) =>
          market.trend
            ? hitRateSortValue(market.trend.last10.hits, market.trend.last10.games)
            : null,
        hitRate: (market) =>
          market.trend
            ? hitRateSortValue(market.trend.last10.hits, market.trend.last10.games)
            : null,
        average: (market) => market.trend?.average,
        opponent: (market) =>
          market.trend?.vsOpponent.games
            ? hitRateSortValue(market.trend.vsOpponent.hits, market.trend.vsOpponent.games)
            : null,
        book: (market) => sportsbookName(market.sportsbook),
        odds: (market) => (market.odds == null ? null : americanOddsToDecimal(market.odds)),
        score: (market) => market.trend?.trendScore,
      });
    return filtered.sort((left, right) =>
      mode === 'trends'
        ? (right.trend?.last10.hitRate ?? -1) - (left.trend?.last10.hitRate ?? -1)
        : (right.trend?.trendScore ?? -1) - (left.trend?.trendScore ?? -1),
    );
  }, [book, eventById, gameId, markets, mode, oddsFilter, oddsMaximum, oddsMinimum, sort]);
  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const visible = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const title = mode === 'games' ? 'Games' : mode === 'lab-finds' ? 'Lab Finds' : 'Trends';
  const description =
    mode === 'games'
      ? 'Browse every upcoming matchup and open its complete sportsbook market board.'
      : mode === 'lab-finds'
        ? 'Prop sides with the strongest support from recent form, matchup, and historical context.'
        : 'Compare expanded player prop research across every upcoming game and sportsbook.';

  return (
    <div className={styles.shell}>
      <MainSiteHeader active="parlay-lab" tone="brand" />
      <ParlayLabSecondaryNav />
      <main className={styles.page}>
        <header className={styles.hero}>
          <span>{mode === 'lab-finds' ? <FlaskConical /> : null} Down &amp; Distance Labs</span>
          <h1>{title}</h1>
          <p>{description}</p>
        </header>

        {mode === 'games' ? (
          <section className={styles.gameGrid}>
            {events.map((event) => (
              <Link key={event.id} href={`/parlay-lab/game/${event.id}/markets`}>
                <div>
                  <small>Week {event.week}</small>
                  <time>
                    {new Date(event.kickoffAt).toLocaleString([], {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                  </time>
                </div>
                <strong>
                  {event.awayTeamId} <i>@</i> {event.homeTeamId}
                </strong>
                <span>{event.marketsLocked ? 'Markets closed' : 'Browse all markets →'}</span>
              </Link>
            ))}
          </section>
        ) : (
          <section className={styles.research}>
            <header className={styles.controls}>
              <div>
                <h2>{mode === 'lab-finds' ? 'Research-backed picks' : 'Trending Props'}</h2>
                <p>{rows.length} available selections</p>
              </div>
              <div className={styles.filterFields}>
                <label>
                  <span>Game</span>
                  <select value={gameId} onChange={(event) => setGameId(event.target.value)}>
                    <option value="ALL">All Games</option>
                    {events.map((event) => (
                      <option key={event.id} value={event.id}>
                        {event.awayTeamId} @ {event.homeTeamId}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>Sportsbook</span>
                  <select value={book} onChange={(event) => setBook(event.target.value)}>
                    <option value="ALL">All Books</option>
                    <option value="FANDUEL">FanDuel</option>
                    <option value="DRAFTKINGS">DraftKings</option>
                    <option value="BETMGM">BetMGM</option>
                    <option value="CAESARS">Caesars</option>
                    <option value="BET365">Bet365</option>
                  </select>
                </label>
                <label title="Filters by sportsbook price only. It does not measure the likelihood of the bet winning.">
                  <span>Odds</span>
                  <select
                    value={oddsFilter}
                    onChange={(event) => setOddsFilter(event.target.value as OddsFilter)}
                  >
                    <option value="ALL">All Odds</option>
                    <option value="-500">-500 or Better</option>
                    <option value="-300">-300 or Better</option>
                    <option value="-200">-200 or Better</option>
                    <option value="-150">-150 or Better</option>
                    <option value="-120">-120 or Better</option>
                    <option value="PLUS">Plus Money</option>
                    <option value="CUSTOM">Custom</option>
                  </select>
                </label>
                {oddsFilter === 'CUSTOM' ? (
                  <div className={styles.range}>
                    <input
                      aria-label="Minimum odds"
                      placeholder="Min"
                      value={oddsMinimum ?? ''}
                      onChange={(event) =>
                        setOddsMinimum(event.target.value ? Number(event.target.value) : null)
                      }
                    />
                    <span>to</span>
                    <input
                      aria-label="Maximum odds"
                      placeholder="Max"
                      value={oddsMaximum ?? ''}
                      onChange={(event) =>
                        setOddsMaximum(event.target.value ? Number(event.target.value) : null)
                      }
                    />
                  </div>
                ) : null}
                <div className={styles.mobileSort}>
                  <label>
                    <span>Sort by</span>
                    <select
                      value={sort?.key ?? (mode === 'trends' ? 'hitRate' : 'score')}
                      onChange={(event) =>
                        setSort({
                          key: event.target.value as ResearchSortKey,
                          direction: sort?.direction ?? 'desc',
                        })
                      }
                    >
                      <option value="score">Trend Score</option>
                      <option value="last10">Last 10</option>
                      <option value="hitRate">Hit Rate</option>
                      <option value="odds">Odds</option>
                      <option value="average">Average</option>
                      <option value="opponent">Vs. Opponent</option>
                    </select>
                  </label>
                  <label>
                    <span>Direction</span>
                    <select
                      value={sort?.direction ?? 'desc'}
                      onChange={(event) =>
                        setSort({
                          key: sort?.key ?? (mode === 'trends' ? 'hitRate' : 'score'),
                          direction: event.target.value as 'asc' | 'desc',
                        })
                      }
                    >
                      <option value="desc">Highest to Lowest</option>
                      <option value="asc">Lowest to Highest</option>
                    </select>
                  </label>
                </div>
              </div>
            </header>
            {gameId !== 'ALL' || book !== 'ALL' || oddsFilter !== 'ALL' ? (
              <div className={styles.activeFilters}>
                {gameId !== 'ALL' ? (
                  <button onClick={() => setGameId('ALL')}>Game filter ×</button>
                ) : null}
                {book !== 'ALL' ? (
                  <button onClick={() => setBook('ALL')}>
                    {sportsbookName(book as Market['sportsbook'])} ×
                  </button>
                ) : null}
                {oddsFilter !== 'ALL' ? (
                  <button onClick={() => setOddsFilter('ALL')}>
                    Odds:{' '}
                    {oddsFilter === 'PLUS'
                      ? 'Plus Money'
                      : oddsFilter === 'CUSTOM'
                        ? 'Custom'
                        : `${oddsFilter} or Better`}{' '}
                    ×
                  </button>
                ) : null}
                <button
                  onClick={() => {
                    setGameId('ALL');
                    setBook('ALL');
                    setOddsFilter('ALL');
                    setSort(null);
                  }}
                >
                  Clear filters
                </button>
              </div>
            ) : null}
            <div className={styles.table}>
              <div className={styles.tableHead}>
                <ParlaySortHeader
                  label="Player"
                  sortKey="player"
                  sort={sort}
                  onSort={(key) => setSort((value) => nextSort(value, key))}
                />
                <ParlaySortHeader
                  label="Game"
                  sortKey="game"
                  sort={sort}
                  onSort={(key) => setSort((value) => nextSort(value, key))}
                />
                <ParlaySortHeader
                  label="Market"
                  sortKey="market"
                  sort={sort}
                  onSort={(key) => setSort((value) => nextSort(value, key))}
                />
                <ParlaySortHeader
                  label="Last 10"
                  sortKey="last10"
                  sort={sort}
                  onSort={(key) => setSort((value) => nextSort(value, key))}
                />
                <ParlaySortHeader
                  label="Hit rate"
                  sortKey="hitRate"
                  sort={sort}
                  onSort={(key) => setSort((value) => nextSort(value, key))}
                />
                <ParlaySortHeader
                  label="Average"
                  sortKey="average"
                  sort={sort}
                  onSort={(key) => setSort((value) => nextSort(value, key))}
                />
                <ParlaySortHeader
                  label="Vs. opponent"
                  sortKey="opponent"
                  sort={sort}
                  onSort={(key) => setSort((value) => nextSort(value, key))}
                />
                <ParlaySortHeader
                  label="Book"
                  sortKey="book"
                  sort={sort}
                  onSort={(key) => setSort((value) => nextSort(value, key))}
                />
                <ParlaySortHeader
                  label="Odds"
                  sortKey="odds"
                  sort={sort}
                  onSort={(key) => setSort((value) => nextSort(value, key))}
                  title="Best currently stored price across selected sportsbooks."
                />
                <ParlaySortHeader
                  label="Score"
                  sortKey="score"
                  sort={sort}
                  onSort={(key) => setSort((value) => nextSort(value, key))}
                  title="Parlay Lab research score. This is not a predicted win probability."
                />
              </div>
              {visible.map((market) => {
                const event = eventById.get(market.eventId ?? gameId);
                return (
                  <Link
                    className={styles.tableRow}
                    key={`${market.eventId}-${market.id}-${market.sportsbook}`}
                    href={`/parlay-lab/game/${market.eventId ?? gameId}/markets`}
                  >
                    <strong>
                      <PlayerAvatar name={market.playerName} headshotUrl={market.headshotUrl} />
                      {market.playerName ?? market.teamId ?? 'Game'}
                    </strong>
                    <span>{event ? `${event.awayTeamId} @ ${event.homeTeamId}` : '—'}</span>
                    <span>
                      <b>{selection(market)}</b> {marketName(market)}
                    </span>
                    <span>
                      {market.trend
                        ? `${market.trend.last10.hits}/${market.trend.last10.games}`
                        : '—'}
                    </span>
                    <span>
                      {market.trend?.last10.hitRate == null
                        ? '—'
                        : `${market.trend.last10.hitRate}%`}
                    </span>
                    <span>{market.trend?.average ?? '—'}</span>
                    <span>
                      {market.trend?.vsOpponent.games
                        ? `${market.trend.vsOpponent.hits}/${market.trend.vsOpponent.games}`
                        : '—'}
                    </span>
                    <span>{sportsbookName(market.sportsbook)}</span>
                    <b>{odds(market.odds)}</b>
                    <span>{market.trend ? `${market.trend.trendScore}/100` : '—'}</span>
                  </Link>
                );
              })}
            </div>
            {loading ? <p className={styles.empty}>Loading research…</p> : null}
            {!loading && !rows.length ? (
              <p className={styles.empty}>No qualifying props are available for this selection.</p>
            ) : null}
            {rows.length > PAGE_SIZE ? (
              <nav className={styles.pagination} aria-label={`${title} pages`}>
                <span>
                  {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, rows.length)} of{' '}
                  {rows.length}
                </span>
                <div>
                  <button
                    aria-label="Previous page"
                    disabled={page === 1}
                    onClick={() => setPage((value) => Math.max(1, value - 1))}
                  >
                    <ChevronLeft />
                  </button>
                  <b>
                    Page {page} of {pageCount}
                  </b>
                  <button
                    aria-label="Next page"
                    disabled={page === pageCount}
                    onClick={() => setPage((value) => Math.min(pageCount, value + 1))}
                  >
                    <ChevronRight />
                  </button>
                </div>
              </nav>
            ) : null}
          </section>
        )}
      </main>
    </div>
  );
}
