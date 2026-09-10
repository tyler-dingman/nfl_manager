import type { CSSProperties } from 'react';

import { getHeroPalette } from '@/lib/playbook-hero';

import styles from './injury-graphic-card.module.css';

export type ContentGraphicTemplate = 'injury' | 'contract';

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

  return (
    <div
      className={`${styles.card}${className ? ` ${className}` : ''}`}
      style={style}
      data-team={teamAbbr.toUpperCase()}
      data-template={template}
      data-testid={`${template}-graphic-card`}
      aria-hidden="true"
    >
      <span className={`${styles.layer} ${contract ? styles.contractPlaybook : styles.playbook}`} />
      <span className={`${styles.layer} ${contract ? styles.contractHalftone : styles.halftone}`} />
      <span className={`${styles.accentLayer} ${contract ? styles.contractBar : styles.bar}`} />
      {contract ? (
        <>
          <span className={`${styles.accentLayer} ${styles.document}`} />
          <span className={`${styles.accentLayer} ${styles.pen}`} />
          <span className={`${styles.accentLayer} ${styles.signature}`} />
          <span className={`${styles.layer} ${styles.ruler}`} />
        </>
      ) : (
        <>
          <span className={`${styles.accentLayer} ${styles.cross}`} />
          <span className={`${styles.accentLayer} ${styles.heartbeat}`} />
        </>
      )}
      <span className={styles.divider} />
      <span className={`${styles.copy} ${contract ? styles.contractCopy : ''}`}>
        <span className={styles.eyebrow}>{eyebrow}</span>
        <span className={styles.headline}>
          <span>{primaryText}</span>
          <span className={styles.accentText}>{accentText}</span>
        </span>
      </span>
    </div>
  );
}
