'use client';
import { useRef, useState, useId } from 'react';
import { createPortal } from 'react-dom';
import { Info, X } from 'lucide-react';
import { useDialogFocus } from '@/hooks/use-dialog-focus';
import { LAB_SCORE_EXPLANATION, LAB_SCORE_TIERS, labScoreTier } from './trending-context';
import styles from './trend-education.module.css';
function Explanation({
  title,
  children,
  close,
}: {
  title: string;
  children: React.ReactNode;
  close: () => void;
}) {
  const ref = useRef<HTMLElement>(null);
  useDialogFocus(true, ref, close);
  return createPortal(
    <div
      className={styles.backdrop}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <section
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby="trend-explanation-title"
        className={styles.dialog}
      >
        <button className={styles.close} onClick={close} aria-label="Close explanation">
          <X />
        </button>
        <h2 id="trend-explanation-title">{title}</h2>
        {children}
      </section>
    </div>,
    document.body,
  );
}
export function TrendHelp({ compact = false }: { compact?: boolean }) {
  const tooltipId = useId();
  const [open, setOpen] = useState(false);
  return (
    <>
      <span className={styles.helpWrap}>
        <button
          aria-describedby={compact ? tooltipId : undefined}
          className={styles.help}
          onClick={(e) => {
            e.stopPropagation();
            setOpen(true);
          }}
          title={LAB_SCORE_EXPLANATION}
          aria-label={compact ? 'About Lab Score' : 'How Trending Props works'}
        >
          <Info size={14} />
          {!compact && 'How this works'}
        </button>
        {compact && (
          <span id={tooltipId} role="tooltip" className={styles.tooltip}>
            <b>Lab Score (0–100)</b>
            <br />
            History, line context, sample quality and side-aware matchup, usage and game context.{' '}
            <strong>Not hit probability or betting value.</strong>
            <br />
            Click to learn more →
          </span>
        )}
      </span>
      {open && (
        <Explanation
          title={compact ? 'Lab Score (0–100)' : 'What makes a prop trend?'}
          close={() => setOpen(false)}
        >
          <p>
            The Parlay Bus scans stored player props for statistical patterns worth researching. Recent
            history, line context, consistency and sample size contribute to the ranking. Defensive
            matchup, usage and stored spread context support or conflict with the selected side.
          </p>
          <h3>Main lines vs alt lines</h3>
          <p>
            <b>Main Line:</b> The sportsbook’s primary threshold. <b>Alt Line:</b> Another offered
            threshold for the same prop. Both can be researched. “Unverified” means stored metadata
            cannot establish the line type; price alone is never used to guess.
          </p>
          <h3>Lab Score (0–100)</h3>
          <p>{LAB_SCORE_EXPLANATION}</p>
          <strong className={styles.warning}>
            Lab Score is not the probability that the bet will hit.
          </strong>
          <p>
            Higher scores mean stronger alignment of available research signals. Easier alternate
            thresholds can have high historical hit rates at heavily juiced prices. Scores use the
            known main line as an anchor; without it, historical evidence is attenuated. Neither hit
            rate nor score establishes betting value.
          </p>
          <p>
            The main line is preferred when its score is within 5 points of the strongest alternate.
            The default view shows one threshold per player, game, market, period and side. Use
            “Show all thresholds” or Line Ladder to explore more.
          </p>
        </Explanation>
      )}
    </>
  );
}
export function LineBadge({
  lineType,
  mainLine,
  passive = false,
}: {
  lineType?: string;
  mainLine?: number | null;
  passive?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const title = lineType === 'alternate' ? 'ALT LINE' : lineType === 'main' ? 'MAIN' : 'UNVERIFIED';
  const explanation =
    lineType === 'alternate'
      ? `This is an alternate threshold for this player prop, not the sportsbook’s primary market.${mainLine != null ? ` Stored main line: ${mainLine}.` : ''}`
      : lineType === 'main'
        ? 'This is the selected sportsbook’s primary threshold in the stored snapshot.'
        : 'The stored data does not confirm whether this is a main or alternate line.';
  if (passive)
    return (
      <span
        tabIndex={0}
        className={`${styles.lineBadge} ${lineType === 'alternate' ? styles.alt : ''}`}
        title={explanation}
        aria-label={`${title}: ${explanation}`}
      >
        {title}
      </span>
    );
  return (
    <>
      <button
        className={`${styles.lineBadge} ${lineType === 'alternate' ? styles.alt : ''}`}
        title={explanation}
        aria-label={`${title}: ${explanation}`}
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
      >
        {title}
      </button>
      {open && (
        <Explanation
          title={
            title === 'ALT LINE'
              ? 'Alternate line'
              : title === 'MAIN'
                ? 'Main line'
                : 'Line type unverified'
          }
          close={() => setOpen(false)}
        >
          <p>{explanation}</p>
          <p>
            Historical hit rate and Lab Score measure the trend at this threshold, not whether its
            price offers good value.
          </p>
        </Explanation>
      )}
    </>
  );
}
export function LabScore({ score, inline = false }: { score?: number | null; inline?: boolean }) {
  if (score == null) return <span>—</span>;
  const tier = labScoreTier(score);
  return (
    <span
      className={`${styles.score} ${inline ? styles.inlineScore : ''}`}
      title={LAB_SCORE_EXPLANATION}
    >
      <b>{score}</b>
      <small data-tier={tier.label}>{tier.label}</small>
    </span>
  );
}
export function LabScoreGuide() {
  return (
    <section className={styles.guide}>
      <header>
        <h2>Lab Score Guide</h2>
        <TrendHelp compact />
      </header>
      {LAB_SCORE_TIERS.map((tier) => (
        <div key={tier.label}>
          <b>
            {tier.range} <span>{tier.label}</span>
          </b>
          <p>{tier.description}</p>
        </div>
      ))}
      <strong className={styles.warning}>
        Research strength, not hit probability or betting value.
      </strong>
      <p>
        Sample confidence is separate from score. Easier alt lines can score highly despite heavily
        juiced odds.
      </p>
    </section>
  );
}
