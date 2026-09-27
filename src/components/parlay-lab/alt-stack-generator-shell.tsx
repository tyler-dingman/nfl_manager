'use client';
import { ResponsiveRail } from '@/components/layout/responsive-rail';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { DashboardShell } from './dashboard-shell';
import { useParlayTeam } from './use-parlay-team';
import MyParlayPanel from './MyParlayPanel';
import PlayerAvatar from './PlayerAvatar';
import { buildSportsbookLink } from './ParlayLabPage';
import type { HomeMarket } from './ParlayLabHome';
import { snapshotSavedPlay, type SavedEvent } from './saved-plays';
import { estimateParlayOdds } from './parlay-odds';
import { marketDisplayName } from '@/lib/parlay-lab/market-display';
import { sportsbookName } from '@/server/odds/sportsbooks';
import {
  ALT_STACK_MARKETS,
  DEFAULT_ALT_STACK,
  altKey,
  altThreshold,
  rankAltStackCandidates,
  selectAltStack,
  swapAltStackLeg,
  type AltStackConfig,
  type AltStackLeg,
} from '@/lib/parlay-lab/alt-stack';
import type { GeneratorGame } from '@/lib/parlay-lab/generator';
import heading from './panel-heading.module.css';
import styles from './alt-stack.module.css';
import ui from './alt-stack-generator.module.css';

const steps = [
  'Scanning available props',
  'Finding high-frequency thresholds',
  'Checking available alternate lines',
  'Balancing hit rate + odds',
  'Building your stack',
];
const price = (n: number | null) => (n == null ? '—' : n > 0 ? `+${n}` : `${n}`);
const marketLabel = (m: HomeMarket) => marketDisplayName(m.marketType);
const currentKey = 'down-distance-parlay-lab-current';
type Event = GeneratorGame & SavedEvent;

export function AltStackGeneratorShell() {
  const team = useParlayTeam();
  const router = useRouter();
  const [config, setConfig] = useState<AltStackConfig>({ ...DEFAULT_ALT_STACK });
  const [events, setEvents] = useState<Event[]>([]);
  const [pool, setPool] = useState<AltStackLeg[]>([]);
  const [stack, setStack] = useState<AltStackLeg[]>([]);
  const [slip, setSlip] = useState<HomeMarket[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState(0);
  const [message, setMessage] = useState('');
  const running = useRef(false);
  const used = useRef<string[]>([]);
  const controller = useRef<AbortController | null>(null);
  const suffix = team ? `?team=${encodeURIComponent(team.abbr)}` : '';
  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(currentKey) ?? '[]');
      if (Array.isArray(stored)) setSlip(stored);
    } catch {
      setMessage('Your previous build could not be restored.');
    }
    setLoaded(true);
    const abort = new AbortController();
    void fetch('/api/parlay-lab/events', { cache: 'no-store', signal: abort.signal })
      .then(async (r) => {
        if (!r.ok) throw new Error('Available games could not be loaded. Generate will retry.');
        const data = await r.json();
        setEvents(data.events ?? []);
      })
      .catch((e) => {
        if (!abort.signal.aborted) setMessage(e.message);
      });
    return () => {
      abort.abort();
      controller.current?.abort();
    };
  }, []);
  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(currentKey, JSON.stringify(slip));
    } catch {
      setMessage('Browser storage is unavailable. Your current stack cannot be persisted.');
    }
  }, [slip, loaded]);
  useEffect(() => {
    if (!busy) return;
    const timer = setInterval(() => setStep((s) => Math.min(s + 1, steps.length - 1)), 1100);
    return () => clearInterval(timer);
  }, [busy]);

  async function generate() {
    if (running.current || !config.markets.length) return;
    running.current = true;
    setBusy(true);
    setStep(0);
    setMessage('');
    const abort = new AbortController();
    controller.current = abort;
    try {
      const response = await fetch('/api/parlay-lab/alt-stack', {
        cache: 'no-store',
        signal: abort.signal,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to load alt lines.');
      setEvents(data.events);
      const ranked = rankAltStackCandidates(data.markets, data.events, config);
      const result = selectAltStack(ranked, config.legs);
      if (!result.legs.length) {
        setMessage(
          `Only ${result.available} qualifying players are available together at one sportsbook; ${config.legs} are required. Try fewer legs, more games, or a lower minimum hit rate. Known main lines, priced alternates and 10 historical games are required. Your current build is unchanged.`,
        );
        return;
      }
      setPool(ranked);
      setStack(result.legs);
      setSlip(result.legs);
      used.current = result.legs.map(altKey);
      setMessage('Your Alt Stack is in My Parlay. Review it and save when ready.');
    } catch (e) {
      if (!abort.signal.aborted)
        setMessage(e instanceof Error ? e.message : 'Generation failed. Please retry.');
    } finally {
      running.current = false;
      if (!abort.signal.aborted) setBusy(false);
    }
  }
  function updateStack(next: AltStackLeg[]) {
    setStack(next);
    setSlip(next);
  }
  function remove(id: string) {
    setSlip((s) => s.filter((m) => m.id !== id));
    setStack((s) => s.filter((m) => m.id !== id));
  }
  function swap(index: number) {
    const fresh = pool.filter((m) =>
      events.some((e) => e.id === m.eventId && Date.parse(e.kickoffAt) > Date.now()),
    );
    const replacement = swapAltStackLeg(fresh, stack, index, used.current);
    if (!replacement) {
      setMessage(
        'No additional qualifying player is available at this sportsbook. Generate again to refresh prices.',
      );
      return;
    }
    used.current.push(altKey(replacement));
    updateStack(stack.map((m, i) => (i === index ? replacement : m)));
    setMessage('Leg swapped. Combined odds updated.');
  }
  function save() {
    const stored = JSON.parse(localStorage.getItem('down-distance-parlay-lab-slips') ?? '[]');
    const eventIds = new Set(slip.map((m) => m.eventId));
    const saved = snapshotSavedPlay({
      id: `alt-stack-${crypto.randomUUID()}`,
      selections: slip,
      event: eventIds.size === 1 ? events.find((e) => e.id === slip[0]?.eventId) : null,
    });
    localStorage.setItem(
      'down-distance-parlay-lab-slips',
      JSON.stringify([saved, ...(Array.isArray(stored) ? stored : [])].slice(0, 20)),
    );
    setMessage('Saved to My Parlays.');
  }
  return (
    <DashboardShell team={team}>
      <div className="lab-dashboard" data-mode="alt-stack">
        <main className="lab-center">
          <header className={`${styles.card} ${styles.shellCard} ${ui.header}`}>
            <p className={styles.eyebrow}>PARLAY LAB</p>
            <h1 className={styles.title}>ALT STACK</h1>
            <p className={styles.tagline}>High-frequency alt lines. Real payout.</p>
            <p className={styles.description}>
              Find player props with strong historical hit rates, lower the line for more cushion,
              and stack the best opportunities into one parlay.
            </p>
          </header>
          <section className={`lab-panel ${ui.config}`} aria-labelledby="build-stack-title">
            <h2 id="build-stack-title" className={heading.heading}>
              Build Your Stack
            </h2>
            <fieldset disabled={busy} className={ui.controls}>
              <legend className={ui.srOnly}>Stack configuration</legend>
              <div>
                <p>How Many Legs?</p>
                <div className={ui.options}>
                  {[4, 6, 8, 10].map((n) => (
                    <button
                      key={n}
                      type="button"
                      aria-pressed={config.legs === n}
                      onClick={() => setConfig((c) => ({ ...c, legs: n }))}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p>Games</p>
                <details className={ui.gamePicker}>
                  <summary>
                    {config.games.length ? `${config.games.length} selected games` : 'All Games'}
                  </summary>
                  <div className={ui.checks}>
                    <label>
                      <input
                        type="checkbox"
                        checked={!config.games.length}
                        onChange={() => setConfig((c) => ({ ...c, games: [] }))}
                      />
                      All Games
                    </label>
                    {events.map((e) => (
                      <label key={e.id}>
                        <input
                          type="checkbox"
                          checked={config.games.includes(e.id)}
                          onChange={(change) =>
                            setConfig((c) => ({
                              ...c,
                              games: change.target.checked
                                ? [...c.games, e.id]
                                : c.games.filter((id) => id !== e.id),
                            }))
                          }
                        />
                        {e.awayTeamId} @ {e.homeTeamId} ·{' '}
                        {new Date(e.kickoffAt).toLocaleDateString()}
                      </label>
                    ))}
                  </div>
                </details>
              </div>
              <div>
                <p>Target Leg Odds</p>
                <div className={ui.options}>
                  {[-200, -350, -500].map((n) => (
                    <button
                      key={n}
                      type="button"
                      aria-pressed={config.targetOdds === n}
                      onClick={() => setConfig((c) => ({ ...c, targetOdds: n }))}
                    >
                      {n}
                    </button>
                  ))}
                </div>
                <small>A target range, not an exact required price.</small>
              </div>
              <div>
                <p>Minimum Hit Rate</p>
                <div className={ui.options}>
                  {[8, 9, 10].map((n) => (
                    <button
                      key={n}
                      type="button"
                      aria-pressed={config.minHits === n}
                      onClick={() => setConfig((c) => ({ ...c, minHits: n }))}
                    >
                      {n}/10{n < 10 ? '+' : ''}
                    </button>
                  ))}
                </div>
              </div>
              <div className={ui.full}>
                <p>Prop Types</p>
                <div className={ui.checks}>
                  {ALT_STACK_MARKETS.map((type) => (
                    <label key={type}>
                      <input
                        type="checkbox"
                        checked={config.markets.includes(type)}
                        onChange={(e) =>
                          setConfig((c) => ({
                            ...c,
                            markets: e.target.checked
                              ? [...c.markets, type]
                              : c.markets.filter((t) => t !== type),
                          }))
                        }
                      />
                      {marketDisplayName(type)}
                    </label>
                  ))}
                </div>
              </div>
            </fieldset>
            {config.markets.includes('ANYTIME_TD') && (
              <p className={ui.note}>
                Anytime TD requires a priced alternate below a known main threshold. Standard
                touchdown yes/no markets do not qualify.
              </p>
            )}
            <button
              className={styles.cta}
              disabled={busy || !loaded || !config.markets.length}
              onClick={generate}
            >
              {busy ? 'BUILDING YOUR ALT STACK…' : `GENERATE MY ${config.legs}-LEG ALT STACK`}
            </button>
            {slip.length > 0 && (
              <p className={ui.note}>
                Generating a new stack replaces the current My Parlay build. Saved parlays are kept.
              </p>
            )}
            {busy && (
              <div role="status" className={ui.processing}>
                <span className={ui.spinner} aria-hidden="true" />
                {steps[step]}…
              </div>
            )}
            <p role="status" className={ui.note}>
              {message}
            </p>
          </section>
          {stack.length > 0 && (
            <section aria-labelledby="your-stack-title" className={ui.results}>
              <div className={ui.resultHeader}>
                <h2 id="your-stack-title" className={heading.heading}>
                  YOUR ALT STACK
                </h2>
                <strong>
                  {stack.length} LEGS · {price(estimateParlayOdds(stack.map((m) => m.odds)))}
                </strong>
              </div>
              {stack.map((m, index) => {
                const t = m.trend!;
                const alternatives = pool.filter(
                  (p) =>
                    p.playerId === m.playerId &&
                    p.eventId === m.eventId &&
                    p.marketType === m.marketType &&
                    p.sportsbook === m.sportsbook,
                );
                return (
                  <article className={`lab-panel ${ui.leg}`} key={altKey(m)}>
                    <div className={styles.playerHeader}>
                      <PlayerAvatar name={m.playerName} headshotUrl={m.headshotUrl} size={44} />
                      <div>
                        <h3>{m.playerName}</h3>
                        <p>
                          {m.teamId} · {m.position} · {marketLabel(m)}
                        </p>
                      </div>
                    </div>
                    <div className={ui.resultHeader}>
                      <strong>
                        {altThreshold(m)} {marketLabel(m).toUpperCase()}
                      </strong>
                      <strong>{price(m.odds)}</strong>
                    </div>
                    <p>
                      {m.mainLine} MAIN LINE → {altThreshold(m)} ALT LINE
                    </p>
                    <div className={ui.stats}>
                      <span>
                        L5{' '}
                        <b>
                          {t.last5.hits}/{t.last5.games}
                        </b>
                      </span>
                      <span>
                        L10{' '}
                        <b>
                          {t.last10.hits}/{t.last10.games}
                        </b>
                      </span>
                      {t.last20 && t.last20.games > 0 && (
                        <span>
                          L20{' '}
                          <b>
                            {t.last20.hits}/{t.last20.games}
                          </b>
                        </span>
                      )}
                      {t.season.games > 0 && (
                        <span>
                          Season{' '}
                          <b>
                            {t.season.hits}/{t.season.games}
                          </b>
                        </span>
                      )}
                      <span>
                        Cushion <b>{Number(m.cushion.toFixed(2))}</b>
                      </span>
                    </div>
                    <ol className={styles.hits} aria-label="Recent games, newest first">
                      {t.gameLog.slice(0, 10).map((g, i) => (
                        <li
                          key={i}
                          className={g.result === 'HIT' ? styles.hit : styles.miss}
                          title={`${g.date}: ${g.statValue} (${g.result})`}
                          aria-label={`${g.date}: ${g.result}`}
                        >
                          {g.result === 'HIT' ? '✓' : g.result === 'PUSH' ? '–' : '×'}
                        </li>
                      ))}
                    </ol>
                    <p className={ui.note}>
                      {sportsbookName(m.sportsbook)} ·{' '}
                      {events.find((e) => e.id === m.eventId)?.awayTeamId} @{' '}
                      {events.find((e) => e.id === m.eventId)?.homeTeamId}
                    </p>
                    <p>
                      <b>Why This Leg?</b> Cleared {altThreshold(m)} {marketLabel(m).toLowerCase()}{' '}
                      in {t.last10.hits} of the last {t.last10.games} games, with{' '}
                      {Number(m.cushion.toFixed(2))} of line cushion from the {m.mainLine} main
                      line.
                    </p>
                    <div className={ui.actions}>
                      <button disabled={busy} onClick={() => swap(index)}>
                        SWAP LEG ↻
                      </button>
                      <button disabled={busy} onClick={() => remove(m.id)}>
                        Remove Leg
                      </button>
                      {alternatives.length > 1 && (
                        <label>
                          Adjust Alt Line
                          <select
                            disabled={busy}
                            value={altKey(m)}
                            onChange={(e) => {
                              const replacement = alternatives.find(
                                (a) => altKey(a) === e.target.value,
                              );
                              if (
                                replacement &&
                                events.some(
                                  (g) =>
                                    g.id === replacement.eventId &&
                                    Date.parse(g.kickoffAt) > Date.now(),
                                )
                              )
                                updateStack(
                                  stack.map((leg, i) => (i === index ? replacement : leg)),
                                );
                              else
                                setMessage(
                                  'This game has started. Generate again for upcoming props.',
                                );
                            }}
                          >
                            {alternatives.map((a) => (
                              <option key={altKey(a)} value={altKey(a)}>
                                {altThreshold(a)} · {price(a.odds)} · {a.trend!.last10.hits}/10
                              </option>
                            ))}
                          </select>
                        </label>
                      )}
                    </div>
                  </article>
                );
              })}
              <p className={ui.note}>
                Historical hit rates are not probabilities or guarantees. Combined odds are an
                estimate; sportsbook pricing and same-game adjustments may differ.
              </p>
            </section>
          )}
        </main>
        <ResponsiveRail stackAt={900} className="lab-right-rail">
          <MyParlayPanel
            legs={slip}
            markets={pool}
            matchup="NFL"
            marketLabel={marketLabel}
            pickLabel={(m) => `${m.side === 'OVER' ? 'Over' : 'Under'} ${m.line}`}
            onRemove={remove}
            onClear={() => {
              setSlip([]);
              setStack([]);
            }}
            onSave={save}
            onResearch={(m) => {
              if (m.eventId)
                router.push(`/parlay-lab/game/${encodeURIComponent(m.eventId)}/markets${suffix}`);
            }}
            buildBookLink={buildSportsbookLink}
          />
          <Link href={`/parlay-lab/my-plays${suffix}`} className={styles.back}>
            View My Parlays →
          </Link>
        </ResponsiveRail>
      </div>
    </DashboardShell>
  );
}
