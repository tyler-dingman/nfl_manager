'use client';

import {
  Beaker,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  Download,
  ExternalLink,
  FlaskConical,
  Plus,
  Search,
  Share2,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import MainSiteHeader from '@/components/main-site-header';
import TeamThemeProvider from '@/components/team-theme-provider';
import { TEAM_LIST } from '@/data/teams';
import {
  SPORTSBOOKS,
  SPORTSBOOK_IDS,
  sportsbookName,
  type Sportsbook,
} from '@/server/odds/sportsbooks';
import {
  marketPlacements,
  PARLAY_CATEGORIES,
  resolvedMarketType,
  type ParlayCategory,
} from './market-category-map';
import { estimateParlayOdds } from './parlay-odds';
import { rowName, sportsbookLineLabel } from './market-display';
import PlayerAvatar from './PlayerAvatar';
import MyParlayPanel from './MyParlayPanel';
import styles from './parlay-lab.module.css';

type OddsEvent = {
  id: string;
  week: number;
  homeTeamId: string;
  awayTeamId: string;
  kickoffAt: string;
  marketsLocked: boolean;
};
export type Market = {
  id: string;
  marketType: string;
  statId: string;
  entityId: string;
  playerId: string | null;
  playerName: string | null;
  headshotUrl?: string | null;
  teamId: string | null;
  period: string;
  side: string;
  line: number | null;
  normalizedKey: string;
  isAltLine: boolean;
  sportsbook: Sportsbook;
  odds: number | null;
  available: boolean;
  deeplink: string | null;
  researchStatus?: 'FULL' | 'PARTIAL' | 'NONE';
  labResearch?: {
    labFindSide: 'OVER' | 'UNDER' | null;
    over: LabSideSummary | null;
    under: LabSideSummary | null;
  } | null;
};
type LabSignal = { label: string; value: string };
type LabSideSummary = {
  sampleSize: number;
  positiveSignals: LabSignal[];
  concerns: LabSignal[];
};
type ComparisonRow = { id: string; market: Market; prices: Partial<Record<Sportsbook, Market>> };

const STAT_LABELS: Record<string, string> = {
  passing_interceptions: 'Passing Interceptions',
  passing_attempts: 'Pass Attempts',
  passing_completions: 'Pass Completions',
  passing_longestCompletion: 'Longest Completion',
  rushing_attempts: 'Rush Attempts',
  rushing_longestRush: 'Longest Rush',
  defense_combinedTackles: 'Combined Tackles',
  defense_soloTackles: 'Solo Tackles',
  defense_assistedTackles: 'Assisted Tackles',
  defense_sacks: 'Sacks',
  kicking_totalPoints: 'Kicking Points',
  extraPoints_kicksMade: 'Extra Points Made',
  bothTeamsScored: 'Both Teams to Score',
  points: 'Points',
};
const humanize = (value: string) =>
  value
    .replaceAll('_', ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
const marketLabel = (market: Market) =>
  STAT_LABELS[market.statId] ??
  (market.marketType === 'OTHER' ? humanize(market.statId) : humanize(market.marketType));
const subjectLabel = (market: Market) => market.playerName ?? market.teamId ?? 'Game';
const lineLabel = (market: Market) =>
  market.line === null
    ? ''
    : market.isAltLine && market.side === 'OVER'
      ? `${Math.ceil(market.line)}+`
      : String(market.line);
const titleFor = (market: Market) =>
  [subjectLabel(market), marketLabel(market), lineLabel(market)].filter(Boolean).join(' · ');
const formatOdds = (odds: number | null) => (odds === null ? '—' : `${odds > 0 ? '+' : ''}${odds}`);
const teamInfo = (abbr: string) => TEAM_LIST.find((team) => team.abbr === abbr);
const avatarColor = (market: Pick<Market, 'teamId'>) =>
  market.teamId ? (teamInfo(market.teamId)?.colors[0] ?? null) : null;
const fullTeamName = (abbr: string) => {
  const team = teamInfo(abbr);
  return team ? `${team.city} ${team.name}` : abbr;
};

export function buildSportsbookLink(markets: Market[], sportsbook: Sportsbook) {
  const links = markets
    .map((market) => market.deeplink)
    .filter((link): link is string => Boolean(link));
  if (!links.length) return null;
  try {
    if (sportsbook === 'FANDUEL') {
      const pairs = links
        .map((link) => new URL(link))
        .map((url) => ({
          marketId: url.searchParams.get('marketId') ?? url.searchParams.get('marketId[0]'),
          selectionId:
            url.searchParams.get('selectionId') ?? url.searchParams.get('selectionId[0]'),
        }))
        .filter((pair) => pair.marketId && pair.selectionId);
      if (!pairs.length) return links[0];
      const url = new URL(links[0]);
      url.search = '';
      pairs.forEach((pair, index) => {
        url.searchParams.set(`marketId[${index}]`, pair.marketId!);
        url.searchParams.set(`selectionId[${index}]`, pair.selectionId!);
      });
      return url.toString();
    }
    const urls = links.map((link) => new URL(link));
    const outcomes = urls
      .flatMap((url) => (url.searchParams.get('outcomes') ?? '').split(','))
      .filter(Boolean);
    if (!outcomes.length) return links[0];
    const url = urls[0];
    url.searchParams.set('outcomes', [...new Set(outcomes)].join(','));
    return url.toString();
  } catch {
    return links[0];
  }
}

function TeamBadge({ abbr }: { abbr: string }) {
  const team = teamInfo(abbr);
  return (
    <span
      className={styles.teamBadge}
      style={{ '--badge-color': team?.colors[0] ?? '#14263b' } as CSSProperties}
    >
      {abbr}
    </span>
  );
}

export function ParlayLabPage({ initialEventId = '' }: { initialEventId?: string }) {
  const [events, setEvents] = useState<OddsEvent[]>([]),
    [eventId, setEventId] = useState('');
  const [markets, setMarkets] = useState<Market[]>([]),
    [book, setBook] = useState<'ALL' | Sportsbook>('ALL');
  const [category, setCategory] = useState<ParlayCategory>('popular'),
    [openSection, setOpenSection] = useState(''),
    [search, setSearch] = useState('');
  const [slip, setSlip] = useState<Market[]>([]),
    [loading, setLoading] = useState(true),
    [notice, setNotice] = useState(''),
    [saveMessage, setSaveMessage] = useState(''),
    [labCheck, setLabCheck] = useState<Market | null>(null);
  const tabNavRef = useRef<HTMLElement>(null);
  const [tabScroll, setTabScroll] = useState({ left: false, right: false });

  useEffect(() => {
    fetch('/api/parlay-lab/events')
      .then(async (response) => {
        if (!response.ok) throw new Error('Odds are not available yet.');
        return response.json();
      })
      .then((body) => {
        const rows = (body.events ?? []) as OddsEvent[];
        setEvents(rows);
        setEventId(
          rows.some((row) => row.id === initialEventId) ? initialEventId : (rows[0]?.id ?? ''),
        );
        if (!rows.length) setNotice('No pregame NFL markets have been imported yet.');
      })
      .catch((error) => setNotice(error.message))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => {
    if (!eventId) return;
    setLoading(true);
    setNotice('');
    fetch(`/api/parlay-lab/events/${encodeURIComponent(eventId)}/markets`)
      .then(async (response) => {
        if (!response.ok) throw new Error('Unable to load markets.');
        return response.json();
      })
      .then((body) => setMarkets(body.markets ?? []))
      .catch((error) => setNotice(error.message))
      .finally(() => setLoading(false));
  }, [eventId]);

  const event = events.find((item) => item.id === eventId);
  const available = useMemo(() => {
    const rows = markets.filter((market) => market.available);
    const halfPointThresholds = new Set(
      rows
        .filter(
          (market) =>
            ['OVER', 'UNDER'].includes(market.side) && Math.abs((market.line ?? NaN) - 0.5) < 0.001,
        )
        .map(
          (market) =>
            `${resolvedMarketType(market)}|${market.statId}|${market.entityId}|${market.period}|${market.sportsbook}|${market.side}`,
        ),
    );

    return rows.filter((market) => {
      if (!['YES', 'NO'].includes(market.side)) return true;
      const type = resolvedMarketType(market);
      // Touchdown Yes/No selections have their own useful presentation. For
      // integer player stats, Yes/No duplicates O/U 0.5 when both are supplied.
      if (type.includes('TD') || type === 'TOUCHDOWNS') return true;
      const equivalentSide = market.side === 'YES' ? 'OVER' : 'UNDER';
      return !halfPointThresholds.has(
        `${type}|${market.statId}|${market.entityId}|${market.period}|${market.sportsbook}|${equivalentSide}`,
      );
    });
  }, [markets]);
  const categorySections = useMemo(() => {
    const result = new Map<ParlayCategory, Map<string, Map<string, ComparisonRow>>>();
    for (const market of available)
      for (const placement of [
        ...marketPlacements(market),
        ...(market.labResearch?.labFindSide === market.side
          ? [{ primaryCategory: 'lab-finds' as const, subcategory: marketLabel(market) }]
          : []),
      ]) {
        const sections =
          result.get(placement.primaryCategory) ?? new Map<string, Map<string, ComparisonRow>>();
        const type = resolvedMarketType(market);
        const playerSectionLabels: Record<string, string> = {
          PASSING_YARDS: market.isAltLine ? 'Alt Passing Yards' : 'Passing Yards',
          PASSING_RUSHING_YARDS: market.isAltLine
            ? 'Alt Passing / Rushing Yards'
            : 'Passing / Rushing Yards',
          PASSING_TD:
            market.side === 'YES' || market.isAltLine
              ? 'Alt Passing Touchdowns'
              : 'Passing Touchdowns',
          PASSING_COMPLETIONS: 'Passing Completions',
          PASSING_ATTEMPTS: 'Passing Attempts',
          PASSING_LONGEST_COMPLETION: 'Longest Completion',
          PASSING_INTERCEPTIONS: 'Interceptions Thrown',
          RUSHING_YARDS: market.isAltLine ? 'Alt Rushing Yards' : 'Rushing Yards',
          RUSHING_ATTEMPTS: 'Rushing Attempts',
          RUSHING_LONGEST_RUSH: 'Longest Rush',
          RECEIVING_YARDS: market.isAltLine ? 'Alt Receiving Yards' : 'Receiving Yards',
          RECEPTIONS: market.isAltLine ? 'Alt Receptions' : 'Receptions',
          RECEIVING_LONGEST_RECEPTION: 'Longest Reception',
          RUSHING_RECEIVING_YARDS: market.isAltLine
            ? 'Alt Rushing / Receiving Yards'
            : 'Rushing / Receiving Yards',
        };
        const periodSpecific = market.period.toLowerCase() !== 'game';
        const playerSection = periodSpecific ? placement.subcategory : playerSectionLabels[type];
        const supportsPlayerAccordions = [
          'passing',
          'receiving',
          'rushing',
          'first-quarter',
          'first-half',
          'second-half',
        ].includes(placement.primaryCategory);
        const sectionName =
          playerSection && market.playerId && supportsPlayerAccordions
            ? `${subjectLabel(market)} · ${playerSection}`
            : placement.subcategory;
        const rows = sections.get(sectionName) ?? new Map<string, ComparisonRow>();
        const row = rows.get(market.id) ?? { id: market.id, market, prices: {} };
        row.prices[market.sportsbook] = market;
        rows.set(market.id, row);
        sections.set(sectionName, rows);
        result.set(placement.primaryCategory, sections);
      }
    return result;
  }, [available]);
  const visibleCategories = PARLAY_CATEGORIES.filter(
    (item) => (categorySections.get(item.id)?.size ?? 0) > 0,
  );
  useEffect(() => {
    const nav = tabNavRef.current;
    if (!nav) return;
    const update = () =>
      setTabScroll({
        left: nav.scrollLeft > 2,
        right: nav.scrollLeft + nav.clientWidth < nav.scrollWidth - 2,
      });
    update();
    const observer = new ResizeObserver(update);
    observer.observe(nav);
    return () => observer.disconnect();
  }, [visibleCategories.length]);
  const activeCategory = visibleCategories.some((item) => item.id === category)
    ? category
    : (visibleCategories[0]?.id ?? 'popular');
  const sections = useMemo(() => {
    const source =
        categorySections.get(activeCategory) ?? new Map<string, Map<string, ComparisonRow>>(),
      query = search.trim().toLowerCase();
    return [...source.entries()]
      .map(([name, rows]) => {
        let values = [...rows.values()].filter(
          (row) => book === 'ALL' || Boolean(row.prices[book]?.available),
        );
        if (query)
          values = values.filter((row) => titleFor(row.market).toLowerCase().includes(query));
        values.sort(
          (a, b) =>
            subjectLabel(a.market).localeCompare(subjectLabel(b.market)) ||
            (a.market.line ?? 0) - (b.market.line ?? 0) ||
            a.market.side.localeCompare(b.market.side),
        );
        if (activeCategory === 'popular' && name === 'Popular Player Props')
          values = values.slice(0, 16);
        return [name, values] as const;
      })
      .filter(([, rows]) => rows.length);
  }, [activeCategory, book, categorySections, search]);
  useEffect(() => {
    setOpenSection(sections[0]?.[0] ?? '');
  }, [activeCategory, eventId]);

  const selected = (id: string) => slip.some((item) => item.id === id);
  const addSelection = (market: Market) => {
    setSaveMessage('');
    setSlip((rows) => [...rows.filter((item) => item.id !== market.id), market]);
  };
  const removeSelection = (id: string) => {
    setSaveMessage('');
    setSlip((rows) => rows.filter((item) => item.id !== id));
  };
  const clearSlip = () => {
    setSaveMessage('');
    setSlip([]);
  };
  const saveSlip = () => {
    if (!slip.length) return;
    try {
      const key = 'down-distance-parlay-lab-slips',
        existing = JSON.parse(localStorage.getItem(key) ?? '[]'),
        saved = Array.isArray(existing) ? existing : [];
      saved.unshift({
        id: `slip-${Date.now()}`,
        createdAt: new Date().toISOString(),
        event,
        selections: slip,
      });
      localStorage.setItem(key, JSON.stringify(saved.slice(0, 20)));
      setSaveMessage('Saved to My Plays.');
    } catch {
      setSaveMessage('This browser could not save the bet slip.');
    }
  };
  const parlayText = () => {
    const matchup = event ? `${event.awayTeamId} @ ${event.homeTeamId}` : 'NFL';
    return [
      '🧪 PARLAY LAB',
      '',
      matchup,
      '',
      ...slip.map((market, index) => `${index + 1}. ${titleFor(market)}`),
      '',
      'Built with Down & Distance Parlay Lab',
    ].join('\n');
  };
  const copyParlay = async () => {
    await navigator.clipboard.writeText(parlayText());
    setSaveMessage('Parlay copied to your clipboard.');
  };
  const shareParlay = async () => {
    if (!navigator.share) return copyParlay();
    await navigator.share({ title: 'Down & Distance Parlay Lab', text: parlayText() });
  };
  const saveParlayImage = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 1080;
    canvas.height = 1080;
    const context = canvas.getContext('2d');
    if (!context) return;
    context.fillStyle = '#071b30';
    context.fillRect(0, 0, 1080, 1080);
    context.fillStyle = '#f16832';
    context.fillRect(0, 0, 1080, 18);
    context.fillStyle = '#ffffff';
    context.font = '800 42px Arial';
    context.fillText('DOWN & DISTANCE', 72, 105);
    context.font = '900 72px Arial';
    context.fillText('PARLAY LAB', 72, 195);
    context.fillStyle = '#f16832';
    context.font = '800 34px Arial';
    context.fillText(event ? `${event.awayTeamId} @ ${event.homeTeamId}` : 'NFL PARLAY', 72, 265);
    context.fillStyle = '#ffffff';
    context.font = '700 32px Arial';
    slip.slice(0, 10).forEach((market, index) => {
      context.fillText(`${index + 1}. ${titleFor(market)}`.slice(0, 54), 72, 350 + index * 62);
    });
    context.fillStyle = '#9eb0c1';
    context.font = '500 25px Arial';
    context.fillText('Research slip — no wager placed', 72, 1000);
    const link = document.createElement('a');
    link.download = `parlay-lab-${Date.now()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };
  const bookAvailability = (market: Market, sportsbook: Sportsbook) =>
    available.find(
      (candidate) => candidate.id === market.id && candidate.sportsbook === sportsbook,
    );
  const estimatedOdds = (sportsbook: Sportsbook) =>
    estimateParlayOdds(slip.map((market) => bookAvailability(market, sportsbook)?.odds));

  return (
    <TeamThemeProvider>
      <div className={styles.shell}>
        <MainSiteHeader active="parlay-lab" />
        <main className={styles.page}>
          <section className={styles.content}>
            <header className={styles.pageHeader}>
              <p>
                <FlaskConical /> Down &amp; Distance Labs
              </p>
              <h1>Parlay Lab</h1>
              <span>
                Research NFL pregame markets and build a parlay plan across stored sportsbook
                prices.
              </span>
            </header>
            <section className={styles.matchupCard}>
              <label>
                Matchup
                <select
                  value={eventId}
                  onChange={(changeEvent) => setEventId(changeEvent.target.value)}
                  disabled={!events.length}
                >
                  {!events.length && <option>No games available</option>}
                  {events.map((item) => (
                    <option key={item.id} value={item.id}>
                      {fullTeamName(item.awayTeamId)} @ {fullTeamName(item.homeTeamId)}
                    </option>
                  ))}
                </select>
              </label>
              {event && (
                <div className={styles.matchup}>
                  <div>
                    <TeamBadge abbr={event.awayTeamId} />
                    <strong>{event.awayTeamId}</strong>
                  </div>
                  <time>
                    <strong>
                      {new Date(event.kickoffAt).toLocaleDateString([], {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </strong>
                    <span>
                      {new Date(event.kickoffAt).toLocaleTimeString([], {
                        hour: 'numeric',
                        minute: '2-digit',
                        timeZoneName: 'short',
                      })}
                    </span>
                  </time>
                  <div>
                    <TeamBadge abbr={event.homeTeamId} />
                    <strong>{event.homeTeamId}</strong>
                  </div>
                </div>
              )}
            </section>
            <div className={styles.filters}>
              <nav
                ref={tabNavRef}
                onScroll={(event) => {
                  const nav = event.currentTarget;
                  setTabScroll({
                    left: nav.scrollLeft > 2,
                    right: nav.scrollLeft + nav.clientWidth < nav.scrollWidth - 2,
                  });
                }}
                className={
                  tabScroll.left && tabScroll.right
                    ? styles.tabsFadeBoth
                    : tabScroll.left
                      ? styles.tabsFadeLeft
                      : tabScroll.right
                        ? styles.tabsFadeRight
                        : undefined
                }
              >
                {visibleCategories.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={activeCategory === item.id ? styles.activeTab : ''}
                    onClick={() => {
                      setCategory(item.id);
                      setSearch('');
                    }}
                  >
                    {item.id === 'lab-finds' && <Beaker aria-hidden="true" />}
                    {item.label}
                  </button>
                ))}
              </nav>
              <div className={styles.secondaryFilters}>
                <label>
                  <Search />
                  <input
                    value={search}
                    onChange={(changeEvent) => setSearch(changeEvent.target.value)}
                    placeholder="Search player or market..."
                  />
                </label>
                <div>
                  {(['ALL', ...SPORTSBOOK_IDS] as const).map((value) => (
                    <button
                      key={value}
                      type="button"
                      className={book === value ? styles.activeBook : ''}
                      onClick={() => setBook(value)}
                    >
                      {value === 'ALL' ? 'All Books' : sportsbookName(value)}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            {loading && <div className={styles.status}>Loading available markets…</div>}
            {!loading && !sections.length && (
              <div className={styles.status}>{notice || 'No markets available for this game.'}</div>
            )}
            <div className={styles.accordions}>
              {sections.map(([name, rows]) => {
                const isOpen = openSection === name;
                const sectionMarket = rows[0]?.market;
                const hasLabFind = rows.some(
                  (row) => row.market.labResearch?.labFindSide === row.market.side,
                );
                return (
                  <section className={styles.accordion} key={name}>
                    <button
                      className={styles.accordionHeader}
                      type="button"
                      onClick={() => setOpenSection(isOpen ? '' : name)}
                    >
                      <span className={styles.accordionTitle}>
                        {sectionMarket?.playerName && (
                          <PlayerAvatar
                            name={sectionMarket.playerName}
                            headshotUrl={sectionMarket.headshotUrl}
                            teamColor={avatarColor(sectionMarket)}
                            size={32}
                          />
                        )}
                        {name}
                        {hasLabFind && (
                          <span
                            className={styles.accordionLabFind}
                            title="LAB FIND — This market contains a side favored by multiple research signals."
                            aria-label="This market contains a Lab Find"
                          >
                            <FlaskConical />
                          </span>
                        )}
                      </span>
                      {isOpen ? <ChevronUp /> : <ChevronDown />}
                    </button>
                    {isOpen && (
                      <div
                        className={`${styles.marketTable} ${book !== 'ALL' ? styles.singleBook : ''}`}
                      >
                        <div
                          className={styles.tableHeader}
                          style={{
                            gridTemplateColumns: `minmax(250px, 1fr) repeat(${book === 'ALL' ? SPORTSBOOKS.length : 1}, 130px) 50px`,
                          }}
                        >
                          <span>Market</span>
                          {SPORTSBOOKS.filter(
                            (sportsbook) => book === 'ALL' || sportsbook.id === book,
                          ).map((sportsbook) => (
                            <span key={sportsbook.id}>{sportsbook.name}</span>
                          ))}
                          <span>Add</span>
                        </div>
                        {rows.slice(0, 80).map((row) => {
                          const visibleBooks = SPORTSBOOKS.filter(
                              (sportsbook) => book === 'ALL' || sportsbook.id === book,
                            ),
                            preferred =
                              book === 'ALL'
                                ? SPORTSBOOK_IDS.map((id) => row.prices[id]).find(Boolean)
                                : row.prices[book],
                            picked = slip.find((item) => item.id === row.id);
                          return (
                            <article
                              className={styles.marketRow}
                              key={row.id}
                              style={{
                                gridTemplateColumns: `minmax(250px, 1fr) repeat(${visibleBooks.length}, 130px) 50px`,
                              }}
                            >
                              <div className={styles.marketIdentity}>
                                <PlayerAvatar
                                  name={row.market.playerName}
                                  headshotUrl={row.market.headshotUrl}
                                  teamColor={avatarColor(row.market)}
                                />
                                <div className={styles.marketName}>
                                  <strong>{rowName(row.market)}</strong>
                                  {row.market.researchStatus === 'PARTIAL' && (
                                    <small>Limited research</small>
                                  )}
                                  {row.market.researchStatus === 'NONE' && (
                                    <small>Historical research not available yet</small>
                                  )}
                                </div>
                              </div>
                              {visibleBooks.map((sportsbook) => (
                                <PriceBox
                                  key={sportsbook.id}
                                  market={row.prices[sportsbook.id]}
                                  selected={picked?.sportsbook === sportsbook.id}
                                  onAdd={addSelection}
                                  showLabFind={
                                    sportsbook.id ===
                                      visibleBooks.find((candidate) => row.prices[candidate.id])
                                        ?.id &&
                                    row.market.labResearch?.labFindSide === row.market.side
                                  }
                                  onLabCheck={setLabCheck}
                                />
                              ))}
                              <button
                                className={selected(row.id) ? styles.rowAdded : styles.rowAdd}
                                type="button"
                                disabled={!preferred}
                                onClick={() =>
                                  preferred &&
                                  (selected(row.id)
                                    ? removeSelection(row.id)
                                    : addSelection(preferred))
                                }
                              >
                                {selected(row.id) ? <Check /> : <Plus />}
                              </button>
                            </article>
                          );
                        })}
                      </div>
                    )}
                  </section>
                );
              })}
            </div>
          </section>
          <MyParlayPanel
            legs={slip}
            markets={available}
            matchup={event ? `${event.awayTeamId} @ ${event.homeTeamId}` : 'NFL'}
            marketLabel={marketLabel}
            pickLabel={sportsbookLineLabel}
            onRemove={removeSelection}
            onClear={clearSlip}
            onSave={saveSlip}
            onResearch={setLabCheck}
            buildBookLink={buildSportsbookLink}
            avatarColor={avatarColor}
          />
          <aside className={styles.slip} hidden>
            <div className={styles.slipHeading}>
              <h2>
                My Parlay <span>{slip.length}</span>
              </h2>
              <button type="button" disabled={!slip.length} onClick={clearSlip}>
                Clear All
              </button>
            </div>
            {!slip.length ? (
              <div className={styles.slipEmpty}>
                <Plus />
                <h2>Build your parlay</h2>
                <p>Add the legs you like while you research.</p>
              </div>
            ) : (
              <div className={styles.slipBody}>
                {slip.map((market, index) => {
                  const availablePrices = SPORTSBOOKS.map((sportsbook) => ({
                    sportsbook,
                    market: bookAvailability(market, sportsbook.id),
                  })).filter((item) => item.market?.available);
                  const bestPrice = [...availablePrices].sort(
                    (a, b) => (b.market?.odds ?? -100000) - (a.market?.odds ?? -100000),
                  )[0];
                  return (
                    <div className={styles.selection} key={market.id}>
                      <span className={styles.legNumber}>{index + 1}</span>
                      <PlayerAvatar
                        name={market.playerName}
                        headshotUrl={market.headshotUrl}
                        teamColor={avatarColor(market)}
                        size={30}
                      />
                      <div>
                        <strong>{titleFor(market)}</strong>
                        <small>
                          {availablePrices
                            .map(
                              ({ sportsbook, market: price }) =>
                                `${sportsbook.name} ${formatOdds(price?.odds ?? null)}`,
                            )
                            .join(' · ')}
                        </small>
                        {bestPrice?.market?.odds !== null &&
                          bestPrice?.market?.odds !== undefined && (
                            <small className={styles.bestPrice}>
                              Best stored price: {bestPrice.sportsbook.name}{' '}
                              {formatOdds(bestPrice.market.odds)}
                            </small>
                          )}
                      </div>
                      <button type="button" onClick={() => removeSelection(market.id)}>
                        <X />
                      </button>
                    </div>
                  );
                })}
                <div className={styles.slipFooter}>
                  <div className={styles.slipTotal}>
                    <strong>
                      {slip.length} Leg{slip.length === 1 ? '' : 's'}
                    </strong>
                    <div>
                      {SPORTSBOOKS.map((sportsbook) => {
                        const estimate = estimatedOdds(sportsbook.id);
                        return estimate === null ? null : (
                          <span key={sportsbook.id}>
                            Est. {sportsbook.name} Odds <b>{formatOdds(estimate)}</b>
                          </span>
                        );
                      })}
                    </div>
                  </div>
                  <small className={styles.estimateNotice}>
                    Estimated by combining current leg prices. Same-game correlation is not
                    included; your sportsbook’s final odds may differ.
                  </small>
                </div>
              </div>
            )}
            {slip.length > 0 && (
              <div className={styles.bookStatus}>
                <div className={styles.planningActions}>
                  <button type="button" onClick={saveSlip}>
                    {saveMessage.startsWith('Parlay saved') ? <Check /> : <Plus />} Save Parlay
                  </button>
                  <button type="button" onClick={shareParlay}>
                    <Share2 /> Share
                  </button>
                  <button type="button" onClick={copyParlay}>
                    <Copy /> Copy
                  </button>
                  <button type="button" onClick={saveParlayImage}>
                    <Download /> Save as Image
                  </button>
                </div>
                {SPORTSBOOKS.map((sportsbook) => {
                  const bookName = sportsbook.name;
                  const selections = slip
                    .map((market) => bookAvailability(market, sportsbook.id))
                    .filter((market): market is Market => Boolean(market?.deeplink));
                  if (!selections.length) return null;
                  const link = buildSportsbookLink(selections, sportsbook.id);
                  return (
                    <div className={styles.bookAction} key={sportsbook.id}>
                      <button
                        type="button"
                        disabled={!link}
                        onClick={() => link && window.open(link, '_blank', 'noopener,noreferrer')}
                      >
                        <span>
                          Open in {bookName} <ExternalLink />
                        </span>
                        <small>Optional sportsbook handoff</small>
                      </button>
                      <p>You may have to add or clear legs manually once in {bookName}.</p>
                    </div>
                  );
                })}
                {saveMessage && (
                  <p className={styles.saveStatus} role="status">
                    {saveMessage}
                  </p>
                )}
                <p className={styles.oddsNotice}>
                  Use this as your research slip. Open your sportsbook and add the legs you want to
                  play. No wager is placed here.
                </p>
              </div>
            )}
          </aside>
        </main>
        {labCheck && (
          <div className={styles.labCheckBackdrop} onMouseDown={() => setLabCheck(null)}>
            <section
              className={styles.labCheck}
              role="dialog"
              aria-modal="true"
              aria-labelledby="lab-check-title"
              onMouseDown={(event) => event.stopPropagation()}
            >
              <button
                className={styles.labCheckClose}
                type="button"
                onClick={() => setLabCheck(null)}
                aria-label="Close Lab Check"
              >
                <X />
              </button>
              <p>
                <FlaskConical /> Lab Check
              </p>
              <div className={styles.labCheckPlayer}>
                <PlayerAvatar
                  name={labCheck.playerName}
                  headshotUrl={labCheck.headshotUrl}
                  teamColor={avatarColor(labCheck)}
                  size={42}
                />
                <h2 id="lab-check-title">{subjectLabel(labCheck)}</h2>
              </div>
              <h3>
                {sportsbookLineLabel(labCheck)} {marketLabel(labCheck)}
              </h3>
              <strong className={styles.labFound}>
                <FlaskConical /> The Lab found something
              </strong>
              <h4>Why it stands out</h4>
              <div className={styles.labSignals}>
                {(labCheck.side === 'UNDER'
                  ? labCheck.labResearch?.under
                  : labCheck.labResearch?.over
                )?.positiveSignals.map((signal) => (
                  <div key={signal.label}>
                    <b>{signal.value}</b>
                    <span>{signal.label}</span>
                  </div>
                ))}
              </div>
              {((labCheck.side === 'UNDER'
                ? labCheck.labResearch?.under
                : labCheck.labResearch?.over
              )?.concerns.length ?? 0) > 0 && (
                <div className={styles.labConcern}>
                  <b>One thing to watch</b>
                  <span>
                    {
                      (labCheck.side === 'UNDER'
                        ? labCheck.labResearch?.under
                        : labCheck.labResearch?.over
                      )?.concerns[0]?.label
                    }
                    :{' '}
                    {
                      (labCheck.side === 'UNDER'
                        ? labCheck.labResearch?.under
                        : labCheck.labResearch?.over
                      )?.concerns[0]?.value
                    }
                  </span>
                </div>
              )}
              <button
                className={styles.labAdd}
                type="button"
                onClick={() => {
                  addSelection(labCheck);
                  setLabCheck(null);
                }}
              >
                <Plus /> Add to parlay
              </button>
            </section>
          </div>
        )}
      </div>
    </TeamThemeProvider>
  );
}

function PriceBox({
  market,
  selected,
  onAdd,
  showLabFind,
  onLabCheck,
}: {
  market?: Market;
  selected: boolean;
  onAdd: (market: Market) => void;
  showLabFind: boolean;
  onLabCheck: (market: Market) => void;
}) {
  return (
    <button
      className={selected ? styles.selectedPrice : styles.priceBox}
      type="button"
      disabled={!market}
      onClick={() => market && onAdd(market)}
    >
      <strong>{market ? sportsbookLineLabel(market) : '—'}</strong>
      <small>
        {market ? formatOdds(market.odds) : 'Not available'}
        {market && showLabFind && (
          <span
            className={styles.labFindIcon}
            role="button"
            tabIndex={0}
            aria-label="LAB FIND: Multiple research signals favor this side. Click for details."
            title="LAB FIND — Multiple research signals favor this side. Click for details."
            onClick={(event) => {
              event.stopPropagation();
              onLabCheck(market);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                event.stopPropagation();
                onLabCheck(market);
              }
            }}
          >
            <FlaskConical />
          </span>
        )}
      </small>
    </button>
  );
}
