'use client';
import { Sparkles, X, Plus } from 'lucide-react';

import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { useDialogFocus } from '@/hooks/use-dialog-focus';
import { generateResearchSlip, parseResearchPrompt } from '@/lib/parlay-lab/research';
import { LineBadge } from './TrendEducation';
import { estimateParlayOdds } from './parlay-odds';
import type { HomeMarket } from './ParlayLabHome';
import styles from './ride-the-bus.module.css';

const rides = [
  ['3-Legger', 'Build me a 3-leg parlay.'],
  ['Plus Money', 'Build me a plus money 3-leg parlay.'],
  ['TD Picks', 'Build me a 3-leg parlay using touchdown props.'],
  ['High Hit Rate', 'Build me a 3-leg parlay using high historical hit-rate props.'],
  ['Unders', 'Build me a 3-leg parlay using strong Under trends.'],
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
}: {
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
  const generate = (text = prompt) => {
    if (!text.trim()) return;
    setPrompt(text);
    setResult(
      generateResearchSlip(
        markets.filter((m) => m.available && m.period === 'game'),
        parseResearchPrompt(text),
      ) as HomeMarket[],
    );
    setExcluded([]);
    setNotice('');
  };
  const selected = (result ?? []).filter((m) => !excluded.includes(key(m)));
  const added = (m: HomeMarket) => slip.some((s) => key(s) === key(m));
  if (!open) return null;
  return createPortal(
    <div
      className={styles.backdrop}
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
              <Sparkles aria-hidden="true" /> Let&apos;s do Science
            </h2>
            <p>Tell us what kind of parlay you’re looking for.</p>
          </div>
          <button aria-label="Close Let's do Science" onClick={onClose}>
            <X />
          </button>
        </header>
        <div className={styles.body}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              generate();
            }}
          >
            <label htmlFor="ride-prompt">Your request</label>
            <textarea
              ref={input}
              id="ride-prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Cook me up a 3-leg parlay..."
              rows={3}
            />
            <button className={styles.primary} disabled={!prompt.trim() || !markets.length}>
              <Sparkles aria-hidden="true" /> Let&apos;s do Science
            </button>
          </form>
          <p className={styles.note}>
            Matches your request to stored markets using existing research rules. Each request
            starts a fresh ride.
          </p>
          <h3>Quick Rides</h3>
          <div className={styles.quick}>
            {rides.map(([label, text]) => (
              <button key={label} disabled={!markets.length} onClick={() => generate(text)}>
                {label}
              </button>
            ))}
          </div>
          {!markets.length && <p role="status">Waiting for available stored markets.</p>}
          {result === null ? (
            <div className={styles.examples}>
              <h3>Try asking</h3>
              {[
                'Give me a plus money 3-legger',
                'Find 3 strong Under trends',
                'Build me 3 touchdown props',
              ].map((text) => (
                <button
                  key={text}
                  onClick={() => {
                    setPrompt(text);
                    input.current?.focus();
                  }}
                >
                  {text} →
                </button>
              ))}
            </div>
          ) : (
            <section aria-labelledby="your-ride">
              <h3 id="your-ride">Your Ride</h3>
              {!result.length ? (
                <p>No stored markets match this request. Try a different team, market or price.</p>
              ) : (
                <>
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
          )}
          <p role="status">{notice}</p>
          <p className={styles.note}>
            Lab Score measures research alignment—not win probability or betting value. Alternate
            lines can have high historical hit rates without offering value.
          </p>
        </div>
      </aside>
    </div>,
    document.body,
  );
}
