'use client';
import { labScoreColor } from '../../../packages/parlay/lab-score-config';

import { LabTestTubeIcon } from './lab-icons';
import { useRef, useState, useId } from 'react';
import { createPortal } from 'react-dom';
import { Info, X } from 'lucide-react';
import { useDialogFocus } from '@/hooks/use-dialog-focus';
import { LAB_SCORE_EXPLANATION, labScoreTier } from './trending-context';
import styles from './trend-education.module.css';
import { LAB_SCORE_CONFIG } from '../../../packages/parlay/lab-score-config';
import { LAB_SCORE_V2_EXPLANATION } from './trending-context';
import { ProjectionDetails } from './ProjectionDetails';
import type { HomeMarket } from '../../../packages/parlay/research';
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
            Parlay Lab scans stored player props for statistical patterns worth researching. Recent
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
            Each selected threshold receives its own statistical score. A likely winner at an
            expensive price can still have poor betting value. Trending requires confirmed current
            role evidence and compares estimated hit probability with the actual offered odds.
          </p>
          <p>
            The default view selects one threshold per player, game, market, period and side using
            score, price value and evidence quality, with a small main-line preference. Weak or
            unconfirmed opportunities stay out of Trending. Use Line Ladder to explore other lines.
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
export function LabScore({
  score,
  inline = false,
  trend,
}: {
  score?: number | null;
  inline?: boolean;
  trend?: Pick<NonNullable<HomeMarket['trend']>, 'scoreVersion' | 'projection'> | null;
}) {
  const [open, setOpen] = useState(false);
  if (score == null || (trend?.projection && trend.projection.estimatedProbability == null))
    return <span title="Insufficient current evidence">—</span>;
  const tier = labScoreTier(score, trend?.scoreVersion);
  return (
    <>
      {trend?.projection ? (
        <button
          type="button"
          className={`${styles.score} ${inline ? styles.inlineScore : ''}`}
          aria-label={`Lab Score ${score}: projection details`}
          onClick={(e) => {
            e.stopPropagation();
            setOpen(true);
          }}
        >
          <b style={{ color: labScoreColor(score) }}>{score}</b>
          <small style={{ color: labScoreColor(score) }} data-tier={tier.label}>
            {tier.label}
          </small>
        </button>
      ) : (
        <span
          className={`${styles.score} ${inline ? styles.inlineScore : ''}`}
          title={LAB_SCORE_EXPLANATION}
        >
          <b style={{ color: labScoreColor(score) }}>{score}</b>
          <small style={{ color: labScoreColor(score) }} data-tier={tier.label}>
            {tier.label}
          </small>
        </span>
      )}
      {open && (
        <Explanation title="Lab Score details" close={() => setOpen(false)}>
          <ProjectionDetails
            projection={trend?.projection}
            active={trend?.scoreVersion === 'v2'}
            stat="stat units"
          />
        </Explanation>
      )}
    </>
  );
}
export function LabScoreGuide(_props: { active?: boolean }) {
  return (
    <section className={styles.guide}>
      <header>
        <h2>
          <LabTestTubeIcon /> Lab Score Guide
        </h2>
        <span title={LAB_SCORE_V2_EXPLANATION}>
          <Info size={14} />
        </span>
      </header>
      {LAB_SCORE_CONFIG.bands.map((tier) => (
        <div key={tier.label}>
          <b>
            {tier.range} · <span>{tier.label}</span>
          </b>
          <p>{tier.description}</p>
        </div>
      ))}
      <strong className={styles.warning}>Research strength, not win probability.</strong>
    </section>
  );
}
