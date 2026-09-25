'use client';
import { marketDisplayName } from '@/lib/parlay-lab/market-display';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import Link from 'next/link';
import type { Team } from '@/features/team/team-store';
import { getEditorialHeroTheme } from '@/lib/team-theme-tokens';
import {
  generateConstrainedParlay,
  describeGeneratorRules,
  parseGeneratorRequest,
  type GeneratorRules,
} from '@/lib/parlay-lab/generator';
import type { HomeMarket } from './ParlayLabHome';
import type { DashboardEvent } from './dashboard-content';
import { useParlayTeamContext } from './use-parlay-team';
import { LabExperimentIcon, LabStatsIcon, LabTrendsIcon, LabInsightsIcon } from './lab-icons';
import PlayerAvatar from './PlayerAvatar';
import { estimateParlayOdds } from './parlay-odds';
import styles from './generator-dashboard.module.css';
const storageKey = 'down-distance-parlay-generator-searches';
const formatOdds = (n: number | null) => (n == null ? '—' : n > 0 ? `+${n}` : String(n));
const label = (m: HomeMarket) =>
  marketDisplayName(m.marketType === 'OTHER' ? m.statId : m.marketType);
const pick = (m: HomeMarket) =>
  `${m.side === 'OVER' ? 'O' : m.side === 'UNDER' ? 'U' : m.side} ${m.line}`;
const suggestions = [
  ['3 legs · strongest signals', '3 legs with the highest Lab Scores'],
  ['Build around my team', 'Build a 3 leg parlay around my team'],
  ['80+ Lab Scores only', '3 legs with all Lab Scores at least 80'],
  ['No touchdown props', '3 legs without touchdown props'],
  ['Same-game parlay', '3 leg same-game parlay'],
  ['Best 4-leg parlay today', 'Best 4-leg parlay today'],
  ['5 legs from 5 different games', '5 legs from 5 different games'],
  ['Most consistent players', '3 legs with the most consistent players'],
  ['High upside (longer odds)', '3 leg parlay with more upside'],
  ['RB props only', '3 leg parlay with RB props only'],
];
function Score({ market }: { market: HomeMarket }) {
  const n = market.trend?.trendScore;
  return (
    <strong
      className="lab-score"
      data-tier={n == null ? 'none' : n >= 70 ? 'good' : n >= 50 ? 'mid' : 'low'}
    >
      {n == null ? '—' : Math.round(n)}
    </strong>
  );
}
export function GeneratorDashboard({
  team,
  markets,
  events,
  loading,
  error,
  slip,
  onAdd,
  onRemove,
  onOpen,
}: {
  team?: Team;
  markets: HomeMarket[];
  events: DashboardEvent[];
  loading: boolean;
  error: string;
  slip: HomeMarket[];
  onAdd: (m: HomeMarket) => void;
  onRemove: (id: string) => void;
  onOpen: (m: HomeMarket) => void;
}) {
  const { favorite } = useParlayTeamContext();
  const colors = getEditorialHeroTheme(team?.abbr);
  const input = useRef<HTMLInputElement>(null),
    sequence = useRef(0);
  const [prompt, setPrompt] = useState(''),
    [asked, setAsked] = useState(''),
    [refinement, setRefinement] = useState(''),
    [rules, setRules] = useState<GeneratorRules | null>(null),
    [result, setResult] = useState<HomeMarket[] | null>(null),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState(''),
    [recent, setRecent] = useState<string[]>([]),
    [current, setCurrent] = useState(markets),
    [currentEvents, setCurrentEvents] = useState(events);
  useEffect(() => setCurrent(markets), [markets]);
  useEffect(() => setCurrentEvents(events), [events]);
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || '[]');
      if (Array.isArray(saved))
        setRecent(saved.filter((s): s is string => typeof s === 'string').slice(0, 8));
    } catch {}
    return () => {
      sequence.current++;
    };
  }, []);
  const eligible = current.filter(
    (m) =>
      m.available &&
      m.period === 'game' &&
      m.playerId &&
      currentEvents.some(
        (e) => e.id === m.eventId && !e.marketsLocked && Date.parse(e.kickoffAt) > Date.now(),
      ),
  );
  const active = [
    ...new Map(eligible.map((m) => [`${m.eventId}:${m.normalizedKey || m.id}`, m])).values(),
  ];
  async function refresh() {
    const response = await fetch('/api/parlay-lab/research?eventId=ALL', { cache: 'no-store' });
    if (!response.ok) throw new Error('Current props could not be verified. Please try again.');
    const body = await response.json();
    if (!Array.isArray(body.markets))
      throw new Error('Current props are unavailable. Please try again.');
    const eventResponse = await fetch('/api/parlay-lab/events', { cache: 'no-store' });
    if (!eventResponse.ok)
      throw new Error('The current game schedule could not be verified. Please try again.');
    const eventBody = await eventResponse.json();
    if (!Array.isArray(eventBody.events))
      throw new Error('The current game schedule is unavailable.');
    setCurrent(body.markets);
    setCurrentEvents(eventBody.events);
    return { markets: body.markets as HomeMarket[], events: eventBody.events as DashboardEvent[] };
  }
  async function generate(
    text: string,
    previous?: GeneratorRules,
    rerun = false,
    override?: GeneratorRules,
  ) {
    if (!text.trim() || busy) return;
    const request = ++sequence.current;
    setBusy(true);
    setNotice('');
    if (override) text = describeGeneratorRules(override);
    setPrompt(text);
    setAsked(text);
    setResult(null);
    try {
      const fresh = await refresh();
      if (sequence.current !== request) return;
      const parsed =
        override ?? parseGeneratorRequest(text, fresh.markets, favorite?.abbr, previous);
      if (previous && /(?:use |with )?different players/i.test(text)) {
        parsed.excludePlayers = result?.map((m) => m.playerId!).filter(Boolean) ?? [];
        parsed.players = [];
      }
      setRules(parsed);
      const generated = generateConstrainedParlay(
        fresh.markets,
        fresh.events,
        parsed,
        rerun ? result?.map((m) => m.id) : [],
      );
      setResult(generated.legs);
      setNotice(generated.message);
      const searches = [text, ...recent.filter((s) => s !== text)].slice(0, 8);
      setRecent(searches);
      try {
        localStorage.setItem(storageKey, JSON.stringify(searches));
      } catch {}
    } catch (e) {
      if (sequence.current === request)
        setNotice(e instanceof Error ? e.message : 'Generation failed. Please try again.');
    } finally {
      if (sequence.current === request) setBusy(false);
    }
  }
  async function addAll() {
    if (!result?.length || busy) return;
    setBusy(true);
    setNotice('');
    try {
      const fresh = await refresh();
      const validated = result.map((leg) =>
        fresh.markets.find(
          (m) =>
            m.id === leg.id &&
            m.sportsbook === leg.sportsbook &&
            m.available &&
            m.line === leg.line &&
            m.odds === leg.odds &&
            m.side === leg.side &&
            (m.trend?.trendScore ?? -1) >= (rules?.minScore ?? 0) &&
            fresh.events.some(
              (e) => e.id === m.eventId && !e.marketsLocked && Date.parse(e.kickoffAt) > Date.now(),
            ),
        ),
      );
      if (validated.some((m) => !m)) {
        setNotice(
          'A line, price, or availability changed. Generate another result before adding these legs.',
        );
        setResult(null);
        return;
      }
      validated.forEach((m) => onAdd(m!));
      setNotice('Added to your existing My Parlay build.');
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'Could not verify current lines.');
    } finally {
      setBusy(false);
    }
  }
  const combined = result?.length ? estimateParlayOdds(result.map((m) => m.odds)) : null;
  const added =
    !!result?.length &&
    result.every((m) => slip.some((s) => s.id === m.id && s.sportsbook === m.sportsbook));
  const focus = () => {
    input.current?.focus();
    input.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  };
  return (
    <div
      className={`lab-dashboard ${styles.dashboard}`}
      data-mode="generator"
      style={
        {
          '--lab-accent': colors.heroPrimaryAccent,
          '--lab-bright': colors.heroBrightAccent,
        } as CSSProperties
      }
    >
      <main className="lab-center">
        <section className={`lab-panel ${styles.hero}`}>
          <div className={styles.heading}>
            <div>
              <h1 className="lab-display">
                PARLAY <em>GENERATOR</em>
              </h1>
              <h2>
                DESCRIBE THE PARLAY. <em>WE&apos;LL FIND THE LEGS.</em>
              </h2>
            </div>
            <div className={styles.metrics}>
              {[
                [LabStatsIcon, active.length, 'Active Props'],
                [
                  LabTrendsIcon,
                  active.filter(
                    (m) =>
                      m.trend &&
                      m.trend.last10.games >= 5 &&
                      m.trend.last10.hits / m.trend.last10.games >= 0.7,
                  ).length,
                  'Trending Now',
                ],
                [
                  LabExperimentIcon,
                  active.filter((m) => (m.trend?.trendScore ?? 0) >= 90).length,
                  '90+ Lab Scores',
                ],
              ].map(([Icon, n, title]) => {
                const Graphic = Icon as typeof LabStatsIcon;
                return (
                  <div key={String(title)}>
                    <Graphic />
                    <b>{loading ? '—' : String(n)}</b>
                    <small>{String(title)}</small>
                  </div>
                );
              })}
            </div>
          </div>
          <form
            className={styles.search}
            onSubmit={(e) => {
              e.preventDefault();
              void generate(prompt);
            }}
          >
            <LabExperimentIcon />
            <input
              ref={input}
              aria-label="Ask the Lab"
              maxLength={500}
              placeholder={
                'Ask the Lab… (e.g. “4 leg parlay with -200 odds and all legs 80 Lab Score or higher”)'
              }
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
            />
            <button aria-label="Generate parlay" disabled={busy || !prompt.trim()}>
              {busy ? '…' : '→'}
            </button>
          </form>
          <div className={styles.chips}>
            {suggestions.map(([title, text], i) => (
              <button key={title} disabled={busy} onClick={() => void generate(text)}>
                {i % 3 === 0 ? (
                  <LabTrendsIcon />
                ) : i % 3 === 1 ? (
                  <LabInsightsIcon />
                ) : (
                  <LabExperimentIcon />
                )}
                {title}
              </button>
            ))}
          </div>
        </section>
        {busy && (
          <p className={styles.message} role="status">
            Checking current saved lines and matching your rules…
          </p>
        )}
        {notice && (
          <p className={styles.message} role="status">
            {notice}
          </p>
        )}
        {result?.length && rules ? (
          <>
            <div className={styles.results}>
              <section className={`lab-panel ${styles.legs}`}>
                <header>
                  <h2>GENERATED RESULT</h2>
                </header>
                <blockquote>
                  <b>YOU ASKED</b>
                  <span>“{asked}”</span>
                </blockquote>
                {result.map((m, i) => (
                  <button
                    className={styles.leg}
                    key={`${m.id}:${m.sportsbook}`}
                    onClick={() => onOpen(m)}
                  >
                    <strong>{String(i + 1).padStart(2, '0')}</strong>
                    <PlayerAvatar
                      name={m.playerName}
                      headshotUrl={m.headshotUrl}
                      size={38}
                      transparent
                    />
                    <span>
                      <b>{m.playerName}</b>
                      <small>
                        {m.teamId}
                        {m.position ? ` · ${m.position}` : ''}
                      </small>
                    </span>
                    <span className={styles.market}>
                      {label(m)}
                      <small>{pick(m)}</small>
                    </span>
                    <span>{formatOdds(m.odds)}</span>
                    <Score market={m} />
                  </button>
                ))}
              </section>
              <section className={`lab-panel ${styles.summary}`}>
                <header>
                  <h2>PARLAY SUMMARY</h2>
                  <span>
                    {result.length} LEGS · {formatOdds(combined)}
                  </span>
                </header>
                <ul>
                  <li>✓ {result.length} legs</li>
                  <li>
                    ✓ Every Lab Score ≥{' '}
                    {Math.floor(Math.min(...result.map((m) => m.trend!.trendScore)))}
                  </li>
                  <li>✓ Estimated combined odds: {formatOdds(combined)}</li>
                  <li>✓ {new Set(result.map((m) => m.playerId)).size} different players</li>
                  {rules.differentGames && (
                    <li>✓ {new Set(result.map((m) => m.eventId)).size} different games</li>
                  )}
                  {rules.sameGame && <li>✓ All legs from the same game</li>}
                  {rules.noTD && <li>✓ No touchdown props</li>}
                  {rules.teams.length > 0 && <li>✓ Teams: {rules.teams.join(', ')}</li>}
                  {rules.positions.length > 0 && <li>✓ Positions: {rules.positions.join(', ')}</li>}
                  {rules.markets.length > 0 && <li>✓ Markets: {rules.markets.join(', ')}</li>}
                  {rules.requiredPosition && <li>✓ Includes a {rules.requiredPosition}</li>}
                  <li>✓ Lines verified at generation · {result[0].sportsbook}</li>
                </ul>
                {rules.targetOdds != null && (
                  <p>
                    Requested target: {formatOdds(rules.targetOdds)}. The actual estimate is{' '}
                    {formatOdds(combined)}; hard rules and Lab quality take priority.
                  </p>
                )}
                <button
                  className="lab-primary"
                  disabled={busy || added}
                  onClick={() => void addAll()}
                >
                  {added ? 'Added to My Parlay' : 'Add All to My Parlay →'}
                </button>
                <div className={styles.actions}>
                  <button
                    disabled={busy}
                    onClick={() => void generate(asked, undefined, true, rules)}
                  >
                    Generate Another
                  </button>
                  <button
                    onClick={() => {
                      setPrompt(describeGeneratorRules(rules));
                      focus();
                    }}
                  >
                    Adjust Parameters
                  </button>
                </div>
                <p>
                  Combined odds are an estimate, not a sportsbook quote. Same-game correlations and
                  sportsbook restrictions may change the price or eligible combinations.
                </p>
              </section>
            </div>
            <form
              className={styles.refine}
              onSubmit={(e) => {
                e.preventDefault();
                void generate(refinement, rules);
                setRefinement('');
              }}
            >
              <input
                aria-label="Refine your parlay"
                placeholder="Refine this result… e.g. remove touchdown props"
                maxLength={500}
                value={refinement}
                onChange={(e) => setRefinement(e.target.value)}
              />
              <button disabled={busy || !refinement.trim()}>Refine →</button>
            </form>
          </>
        ) : result?.length === 0 ? (
          <section className={`lab-panel ${styles.onboarding}`}>
            <h2>No matching parlay</h2>
            <p>No result was invented or added. Adjust the rules and try again.</p>
            <div className={styles.actions}>
              {rules && rules.minScore > 80 && (
                <button
                  onClick={() =>
                    void generate(asked, undefined, false, { ...rules, minScore: 80, issues: [] })
                  }
                >
                  Lower to 80+
                </button>
              )}
              {rules && rules.legs > 1 && (
                <button
                  onClick={() =>
                    void generate(asked, undefined, false, {
                      ...rules,
                      legs: rules.legs - 1,
                      issues: [],
                    })
                  }
                >
                  Use {rules.legs - 1} legs
                </button>
              )}
              {rules && (
                <button
                  onClick={() =>
                    void generate(asked, undefined, false, {
                      ...rules,
                      teams: [],
                      sameGame: false,
                      today: false,
                      issues: [],
                    })
                  }
                >
                  Expand to all games
                </button>
              )}
            </div>
          </section>
        ) : (
          !busy && (
            <section className={`lab-panel ${styles.onboarding}`}>
              <LabExperimentIcon />
              <h2>Your request. Real props.</h2>
              <p>
                Describe the legs, teams, markets, or minimum Lab Score you want. The Lab will match
                your rules against saved, currently available research.
              </p>
              {error && <p>{error}</p>}
            </section>
          )
        )}
        <p className={styles.disclosure}>
          For research and entertainment. Lab Scores and historical performance are not guarantees.
          Review every leg and the sportsbook&apos;s final price before wagering.
        </p>
      </main>
      <aside className="lab-right-rail">
        <section className={`lab-panel ${styles.parlay}`}>
          <header>
            <h2>
              <LabExperimentIcon />
              My Parlay <span>{slip.length}</span>
            </h2>
          </header>
          {slip.length ? (
            <>
              {slip.slice(0, 5).map((m) => (
                <div className={styles.saved} key={`${m.id}:${m.sportsbook}`}>
                  <PlayerAvatar name={m.playerName} headshotUrl={m.headshotUrl} transparent />
                  <button onClick={() => onOpen(m)}>
                    {m.playerName}
                    <small>
                      {pick(m)} {label(m)}
                    </small>
                  </button>
                  <button aria-label={`Remove ${m.playerName}`} onClick={() => onRemove(m.id)}>
                    ⊖
                  </button>
                </div>
              ))}
              <Link
                className="lab-primary"
                href={`/parlay-lab/my-plays${team ? `?team=${team.abbr}` : ''}`}
              >
                View My Parlay ({slip.length}) →
              </Link>
            </>
          ) : (
            <div className={styles.empty}>
              <span>＋</span>
              <b>Build your parlay</b>
              <p>Add the legs you like while you research.</p>
              <button className="lab-primary" onClick={focus}>
                Create a Parlay →
              </button>
            </div>
          )}
        </section>
        <section className="lab-panel">
          <header>
            <h2>
              <LabInsightsIcon />
              Recent Searches
            </h2>
          </header>
          {recent.length ? (
            recent.map((text) => (
              <button
                className={styles.recent}
                key={text}
                disabled={busy}
                onClick={() => void generate(text)}
              >
                ↗ <span>{text}</span>
              </button>
            ))
          ) : (
            <p className="lab-empty">Your searches will appear here on this device.</p>
          )}
        </section>
        <section className={`lab-panel ${styles.how}`}>
          <header>
            <h2>
              <LabExperimentIcon />
              How the Lab Builds
            </h2>
          </header>
          <p>
            <b>REAL PROPS</b>Only current saved lines.
          </p>
          <p>
            <b>LAB DATA</b>Existing scores and research signals.
          </p>
          <p>
            <b>YOUR RULES</b>Hard constraints first, Lab quality next, target odds after.
          </p>
        </section>
      </aside>
    </div>
  );
}
