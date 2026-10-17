import { labScoreColor } from '../../../packages/parlay/lab-score-config';
import { frontOfficeFont } from '@/components/front-office/front-office-font';
import { Users, BarChart3, Clock3, Zap, Target } from 'lucide-react';
import { projectionDetails } from '../../../packages/parlay/projection-details';
import type { LabScoreV2 } from '@/server/historical-stats/lab-score-v2';
import type { ReactNode } from 'react';
import styles from './projection-details.module.css';
export function ProjectionDetails({
  projection,
  active,
  stat,
  position,
  children,
}: {
  projection?: LabScoreV2;
  active: boolean;
  stat: string;
  position?: string | null;
  children?: ReactNode;
}) {
  const d = projectionDetails(projection, active, stat, position);
  const icons = [Users, BarChart3, Clock3];
  return (
    <section
      className={`${styles.panel} ${frontOfficeFont.variable}`}
      aria-label="Lab Score 2.0 dashboard"
      data-score-dashboard
    >
      <div className={styles.model}>
        <div className={styles.score} data-overview-order="score">
          <h3>Lab Score 2.0</h3>
          <div
            className={styles.gauge}
            role="img"
            aria-label={`Lab Score 2.0 ${d.score ?? 'unavailable'}, ${d.confidence} confidence. Not a win probability.`}
          >
            <svg viewBox="0 0 200 170" aria-hidden="true">
              <path d="M 36 144 A 82 82 0 1 1 164 144" pathLength="100" className={styles.track} />
              <path
                d="M 36 144 A 82 82 0 1 1 164 144"
                pathLength="100"
                className={styles.arc}
                style={{ stroke: labScoreColor(d.score) }}
                strokeDasharray={`${d.score ?? 0} 100`}
              />
            </svg>
            <div>
              <strong style={{ color: labScoreColor(d.score) }}>{d.score ?? '—'}</strong>
              <span>{d.band}</span>
            </div>
          </div>
          <p>{d.sentence}</p>
        </div>
        <div className={styles.pick} data-overview-order="pick">
          <small>
            <Target size={15} /> The pick
          </small>
          <h4>{d.pick}</h4>
          <h5>{d.stat}</h5>
          <dl>
            {d.metrics.map(([label, value]) => (
              <div key={label}>
                <dd>{value}</dd>
                <dt>{label}</dt>
              </div>
            ))}
          </dl>
        </div>
        <div className={styles.explanation} data-overview-order="why">
          <h4>{d.lean}</h4>
          <div className={styles.signals}>
            {d.signals.map((signal, i) => {
              const Icon = icons[i]!;
              return (
                <div key={signal.label}>
                  <Icon size={24} />
                  <div>
                    <small>{signal.label}</small>
                    <strong>{signal.value}</strong>
                    <p>{signal.note}</p>
                  </div>
                </div>
              );
            })}
          </div>
          <div
            className={`${styles.callout} ${d.material ? styles.changed : ''}`}
            data-overview-order="insight"
          >
            {d.material && <Zap size={25} />}
            <div>
              <header>
                <h4>{d.calloutTitle}</h4>
                {d.material && (
                  <span>
                    Role confidence <b>{d.roleConfidence}</b>
                  </span>
                )}
              </header>
              <strong>{d.calloutLead}</strong>
              <p>{d.calloutText}</p>
            </div>
          </div>
        </div>
      </div>
      <div className={styles.breakdown} aria-label="Score components">
        {d.breakdown.map((c) => (
          <div key={c.label}>
            <span>
              {c.label} · {c.weight == null ? '—' : `${Math.round(c.weight * 100)}%`}
            </span>
            <strong>{c.score == null ? 'Unavailable' : `${Math.round(c.score)}/100`}</strong>
          </div>
        ))}
      </div>
      <p className={styles.footnote}>{d.explanation}</p>
      <p className={styles.footnote}>
        Estimated hit probability: {d.probability}. Betting value: {d.value}. {d.reliability}.
        Missing optional components are reweighted; evidence reliability moderates the final score.
      </p>
      {children}
      <p className={styles.footnote}>{d.historyNote}</p>
    </section>
  );
}
