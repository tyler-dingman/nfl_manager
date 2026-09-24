'use client';
import {
  Sparkles,
  X,
  Plus,
  BarChart3,
  Star,
  Coins,
  TrendingUp,
  ArrowDown,
  ChevronDown,
  Layers,
  LoaderCircle,
} from 'lucide-react';
import { DdFootballIcon } from '@/components/ui/football-icons';
import { toTeamStyle } from '@/components/team-theme-provider';
import type { Team } from '@/features/team/team-store';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { useDialogFocus } from '@/hooks/use-dialog-focus';
import { generateResearchSlip, parseResearchPrompt } from '@/lib/parlay-lab/research';
import { LineBadge } from './TrendEducation';
import { estimateParlayOdds } from './parlay-odds';
import type { HomeMarket } from './ParlayLabHome';
import styles from './ride-the-bus.module.css';

const rides = [
  {
    label: '3-Legger',
    text: 'Build me a 3-leg parlay.',
    description: 'A balanced 3-pick parlay with strong value.',
    icon: Star,
  },
  {
    label: 'Plus Money',
    text: 'Build me a plus money 3-leg parlay.',
    description: 'Higher payout parlays with smart picks.',
    icon: Coins,
  },
  {
    label: 'TD Picks',
    text: 'Build me a 3-leg parlay using touchdown props.',
    description: 'Build a parlay around touchdown scorers.',
    icon: BarChart3,
  },
  {
    label: 'High Hit Rate',
    text: 'Build me a 3-leg parlay using high historical hit-rate props.',
    description: 'Lower risk picks with strong probabilities.',
    icon: TrendingUp,
  },
  {
    label: 'Unders',
    text: 'Build me a 3-leg parlay using strong Under trends.',
    description: 'Find value with unders across key stats.',
    icon: ArrowDown,
  },
];
const key = (m: HomeMarket) => `${m.id}:${m.sportsbook}`;
const odds = (n: number | null) => (n === null ? 'Unavailable' : n > 0 ? `+${n}` : String(n));
export default function RideTheBusDrawer({
  open,
  onClose,
  markets,
  slip,
  onAdd,
  onResearch,
  team,
  marketState,
  marketError,
  onRetry,
}: {
  team?: Team;
  marketState: 'loading' | 'ready' | 'error';
  marketError: string;
  onRetry: () => void;
  open: boolean;
  onClose: () => void;
  markets: HomeMarket[];
  slip: HomeMarket[];
  onAdd: (legs: HomeMarket[]) => void;
  onResearch: (leg: HomeMarket) => void;
}) {
  const ref = useRef<HTMLElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const [prompt, setPrompt] = useState('');
  const [result, setResult] = useState<HomeMarket[] | null>(null);
  const [excluded, setExcluded] = useState<string[]>([]);
  const [notice, setNotice] = useState('');
  useDialogFocus(open, ref, onClose);
  const [preset, setPreset] = useState<string | null>(null);
  const [risk, setRisk] = useState<'balanced' | 'high'>('balanced');
  const [maxLegs, setMaxLegs] = useState(3);
  const [settingsOpen, setSettingsOpen] = useState(true);
  const [generating, setGenerating] = useState(false);
  const generation = useRef(0);
  useEffect(() => {
    if (!open) {
      generation.current++;
      setGenerating(false);
    }
  }, [open]);
  const eligibleMarkets = markets.filter((m) => m.available && m.period === 'game');
  const configure = (text: string, selectedPreset: string | null = null) => {
    generation.current++;
    setGenerating(false);
    const intent = parseResearchPrompt(text);
    setPrompt(text.slice(0, 500));
    setPreset(selectedPreset);
    setRisk(intent.confidence);
    setMaxLegs(intent.legCount);
    setResult(null);
    setNotice('');
  };
  const generate = async () => {
    if (!prompt.trim() || generating || marketState !== 'ready' || !eligibleMarkets.length) return;
    const request = ++generation.current;
    setGenerating(true);
    setResult(null);
    setExcluded([]);
    setNotice('');
    // Give the pending state a paint before running the existing synchronous research engine.
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    );
    try {
      const next = generateResearchSlip(eligibleMarkets, {
        ...parseResearchPrompt(prompt),
        legCount: maxLegs,
        confidence: risk,
      }) as HomeMarket[];
      if (request === generation.current) setResult(next);
    } catch {
      if (request === generation.current)
        setNotice('Your parlay could not be created. Please try again.');
    } finally {
      if (request === generation.current) setGenerating(false);
    }
  };
  const selected = (result ?? []).filter((m) => !excluded.includes(key(m)));
  const added = (m: HomeMarket) => slip.some((s) => key(s) === key(m));
  if (!open) return null;
  return createPortal(
    <div
      className={styles.backdrop}
      style={toTeamStyle(team)}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <aside
        ref={ref}
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="ride-title"
      >
        <header>
          <div>
            <h2 id="ride-title">
              <BarChart3 aria-hidden="true" />
              Create a Parlay
            </h2>
            <p>
              Tell us what kind of parlay you’re looking for. We’ll use real data and proven trends
              to build the best slip for you.
            </p>
          </div>
          <button aria-label="Close Create a Parlay" onClick={onClose}>
            <X />
          </button>
        </header>
        <div className={styles.body}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void generate();
            }}
          >
            <label className={styles.sectionTitle} htmlFor="ride-prompt">
              Describe your parlay
            </label>
            <textarea
              ref={input}
              id="ride-prompt"
              value={prompt}
              maxLength={500}
              onChange={(e) => configure(e.target.value)}
              placeholder="e.g. A 3-leg NFL parlay with passing yards, touchdown scorers, and strong under trends..."
              rows={3}
              aria-describedby="ride-counter"
            />
            <span id="ride-counter" className={styles.counter}>
              {prompt.length}/500
            </span>
            <section aria-labelledby="quick-starts">
              <h3 id="quick-starts">Quick Starts</h3>
              <p className={styles.description}>
                Try a popular parlay type or let us build one based on what you’re looking for.
              </p>
              <div className={styles.quick}>
                {rides.map(({ label, text, description, icon: Icon }, index) => (
                  <button
                    type="button"
                    key={label}
                    aria-label={label}
                    aria-pressed={preset === label}
                    disabled={generating}
                    onClick={() => configure(text, label)}
                  >
                    <Icon className={index % 2 === 0 ? styles.accent : ''} aria-hidden="true" />
                    <strong>{label}</strong>
                    <span>{description}</span>
                  </button>
                ))}
              </div>
            </section>
            <section className={styles.settings}>
              <button
                type="button"
                className={styles.settingsToggle}
                aria-expanded={settingsOpen}
                aria-controls="parlay-settings"
                onClick={() => setSettingsOpen(!settingsOpen)}
              >
                Optional Settings
                <ChevronDown />
              </button>
              <div id="parlay-settings" className={styles.settingsGrid} hidden={!settingsOpen}>
                <label>
                  <DdFootballIcon aria-hidden="true" />
                  <span>
                    Preferred Sports
                    <select defaultValue="NFL">
                      <option>NFL</option>
                    </select>
                  </span>
                </label>
                <label>
                  <BarChart3 aria-hidden="true" />
                  <span>
                    Risk Level
                    <select
                      disabled={generating}
                      value={risk}
                      onChange={(e) => {
                        setRisk(e.target.value as 'balanced' | 'high');
                        setPreset(null);
                        setResult(null);
                      }}
                    >
                      <option value="high">Conservative</option>
                      <option value="balanced">Balanced</option>
                    </select>
                  </span>
                </label>
                <label>
                  <Layers aria-hidden="true" />
                  <span>
                    Max Legs
                    <select
                      disabled={generating}
                      value={maxLegs}
                      onChange={(e) => {
                        setMaxLegs(Number(e.target.value));
                        setPreset(null);
                        setResult(null);
                      }}
                    >
                      {Array.from({ length: 8 }, (_, i) => (
                        <option key={i + 1} value={i + 1}>
                          {i + 1} {i === 0 ? 'Leg' : 'Legs'}
                        </option>
                      ))}
                    </select>
                  </span>
                </label>
              </div>
            </section>
            {marketState === 'error' ? (
              <div className={styles.marketStatus} role="alert">
                {marketError}
                <button type="button" onClick={onRetry}>
                  Retry
                </button>
              </div>
            ) : marketState === 'ready' && !eligibleMarkets.length ? (
              <p className={styles.marketStatus} role="status">
                There aren’t enough eligible markets available right now. Try another game or check
                again later.
              </p>
            ) : null}
            <button
              className={styles.primary}
              disabled={
                !prompt.trim() || marketState !== 'ready' || !eligibleMarkets.length || generating
              }
            >
              {generating || marketState === 'loading' ? (
                <LoaderCircle className={styles.spinner} aria-hidden="true" />
              ) : (
                <Sparkles aria-hidden="true" />
              )}
              {generating
                ? 'Building your parlay…'
                : marketState === 'loading'
                  ? 'Loading available markets…'
                  : 'Create My Parlay'}
            </button>
            <p className={styles.note}>
              Uses available stored odds, stats and research. Each request starts a fresh ride.
            </p>
            {generating ? (
              <p role="status" className={styles.note}>
                Finding eligible markets and checking research…
              </p>
            ) : null}
          </form>
          {result !== null ? (
            <section aria-labelledby="your-ride">
              <h3 id="your-ride">Your Ride</h3>
              {!result.length ? (
                <p>No stored markets match this request. Try a different team, market or price.</p>
              ) : (
                <>
                  {result.length < maxLegs ? (
                    <p role="status" className={styles.marketStatus}>
                      Only {result.length} eligible{' '}
                      {result.length === 1 ? 'leg matches' : 'legs match'} this request. Try
                      adjusting your settings for more options.
                    </p>
                  ) : null}
                  <p>
                    {selected.length} Legs · Estimated combined odds{' '}
                    {odds(estimateParlayOdds(selected.map((m) => m.odds)))}
                  </p>
                  <p className={styles.note}>
                    Combined odds are illustrative; sportsbook pricing and correlations may differ.
                  </p>
                  {result.map((m) => (
                    <article className={styles.leg} key={key(m)}>
                      <label>
                        <input
                          type="checkbox"
                          aria-label={`Include ${m.playerName}`}
                          checked={!excluded.includes(key(m))}
                          onChange={() =>
                            setExcluded((prev) =>
                              prev.includes(key(m))
                                ? prev.filter((k) => k !== key(m))
                                : [...prev, key(m)],
                            )
                          }
                        />
                        <span>{m.playerName ?? m.teamId}</span>
                      </label>
                      <p>
                        {m.side === 'UNDER' ? 'U' : 'O'} {m.line} ·{' '}
                        {m.marketType.toLowerCase().replaceAll('_', ' ')}
                      </p>
                      {m.lineType !== 'main' && (
                        <LineBadge passive lineType={m.lineType} mainLine={m.mainLine} />
                      )}
                      <p>
                        {m.sportsbook} {odds(m.odds)}
                      </p>
                      <p className={styles.note}>
                        {m.trend
                          ? `${m.trend.last10.hits}/${m.trend.last10.games} L10 · Lab Score ${m.trend.trendScore}`
                          : 'Insufficient history'}
                        {m.matchup?.explanation ? ` · ${m.matchup.explanation}` : ''}
                      </p>
                      <div className={styles.actions}>
                        <button onClick={() => onResearch(m)}>Research</button>
                        <button disabled={added(m)} onClick={() => onAdd([m])}>
                          {added(m) ? 'Added' : '+ Add'}
                        </button>
                      </div>
                    </article>
                  ))}
                  <button
                    className={styles.primary}
                    disabled={!selected.length || selected.every(added)}
                    onClick={() => {
                      onAdd(selected);
                      setNotice('Ride added to My Parlay.');
                    }}
                  >
                    <Plus aria-hidden="true" /> Add Ride to My Parlay
                  </button>
                </>
              )}
              <button
                className={styles.newRide}
                onClick={() => {
                  setResult(null);
                  setNotice('');
                  input.current?.focus();
                }}
              >
                New Ride
              </button>
            </section>
          ) : null}
          <p role="status">{notice}</p>
          {result !== null ? (
            <p className={styles.note}>
              Lab Score measures research alignment—not win probability or betting value. Alternate
              lines can have high historical hit rates without offering value.
            </p>
          ) : null}
        </div>
      </aside>
    </div>,
    document.body,
  );
}
