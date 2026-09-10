import type { CSSProperties } from 'react';

import { getHeroPalette } from '@/lib/playbook-hero';

import styles from './injury-graphic-card.module.css';

export type ContentGraphicTemplate = 'injury' | 'contract' | 'trade-talk' | 'rookie-blueprint';

export function getContentGraphicAccent(teamAbbr: string) {
  const palette = getHeroPalette(teamAbbr);
  return new Set(['BAL', 'CAR']).has(teamAbbr.toUpperCase())
    ? palette.primaryRoute
    : palette.secondaryRoute;
}

export default function ContentGraphicCard({
  template,
  teamAbbr,
  eyebrow,
  primaryText,
  accentText,
  className,
}: {
  template: ContentGraphicTemplate;
  teamAbbr: string;
  eyebrow: string;
  primaryText: string;
  accentText: string;
  className?: string;
}) {
  const style = { '--card-accent': getContentGraphicAccent(teamAbbr) } as CSSProperties;
  const contract = template === 'contract';
  const tradeTalk = template === 'trade-talk';
  const rookieBlueprint = template === 'rookie-blueprint';

  return (
    <div
      className={`${styles.card}${className ? ` ${className}` : ''}`}
      style={style}
      data-team={teamAbbr.toUpperCase()}
      data-template={template}
      data-testid={`${template}-graphic-card`}
      aria-hidden="true"
    >
      <span
        className={`${styles.layer} ${contract ? styles.contractPlaybook : tradeTalk ? styles.tradePlaybook : rookieBlueprint ? styles.rookiePlaybook : styles.playbook}`}
      />
      <span
        className={`${styles.layer} ${contract ? styles.contractHalftone : tradeTalk ? styles.tradeHalftone : rookieBlueprint ? styles.rookieHalftone : styles.halftone}`}
      />
      {contract ? (
        <span className={`${styles.accentLayer} ${styles.contractOverlay}`} />
      ) : tradeTalk ? (
        <>
          <span className={`${styles.accentLayer} ${styles.tradeBar}`} />
          <span className={`${styles.accentLayer} ${styles.tradeArrowRight}`} />
          <span className={`${styles.accentLayer} ${styles.tradeArrowLeft}`} />
          <span className={`${styles.accentLayer} ${styles.tradeStreaks}`} />
          <span className={`${styles.layer} ${styles.tradeRuler}`} />
        </>
      ) : rookieBlueprint ? (
        <>
          <span className={`${styles.accentLayer} ${styles.bar}`} />
          <span className={`${styles.layer} ${styles.rookieRuler}`} />
        </>
      ) : (
        <>
          <span className={`${styles.accentLayer} ${styles.bar}`} />
          <span className={`${styles.accentLayer} ${styles.cross}`} />
          <span className={`${styles.accentLayer} ${styles.heartbeat}`} />
        </>
      )}
      {!contract ? <span className={styles.divider} /> : null}
      <span
        className={`${styles.copy} ${contract ? styles.contractCopy : tradeTalk ? styles.tradeCopy : rookieBlueprint ? styles.rookieCopy : ''}`}
      >
        <span className={styles.eyebrow}>{eyebrow}</span>
        <span className={styles.headline}>
          <span>{primaryText}</span>
          <span className={styles.accentText}>{accentText}</span>
        </span>
      </span>
    </div>
  );
}
