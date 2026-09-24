import type { CSSProperties } from 'react';

import styles from './news-graphic.module.css';

export type NewsGraphicVariant =
  | 'trade-rumor'
  | 'trade'
  | 'injury'
  | 'game-recap'
  | 'contract'
  | 'signing'
  | 'player-performance'
  | 'draft'
  | 'standings'
  | 'coach'
  | 'rumor'
  | 'breaking';

export type NewsGraphicTeam = {
  id: string;
  abbreviation: string;
  displayName: string;
  primaryColor: string;
  secondaryColor: string;
  logoUrl?: string;
};

export type NewsGraphicProps = {
  variant: NewsGraphicVariant;
  size?: 'hero' | 'card' | 'compact';
  team?: NewsGraphicTeam;
  opponent?: NewsGraphicTeam;
  player?: { id: string; name: string; number?: number | string; position?: string };
  headline: string;
  description?: string;
  stats?: Array<{ label: string; value: string | number }>;
  score?: { team: number; opponent: number; status?: string };
  label?: string;
  className?: string;
};

const defaultLabel: Record<NewsGraphicVariant, string> = {
  'trade-rumor': 'Trade rumor',
  trade: 'Trade talk',
  injury: 'Injury update',
  'game-recap': 'Game recap',
  contract: 'Contract update',
  signing: 'Transaction',
  'player-performance': 'Player performance',
  draft: 'Draft',
  standings: 'Standings',
  coach: 'Front office',
  rumor: 'Developing story',
  breaking: 'Breaking news',
};

export function NewsGraphic({
  variant,
  size = 'card',
  team,
  opponent,
  player,
  headline,
  description,
  stats = [],
  score,
  label,
  className = '',
}: NewsGraphicProps) {
  const style = {
    '--team-primary': team?.primaryColor ?? '#d71920',
    '--team-secondary': team?.secondaryColor ?? '#f2c400',
    '--opponent-primary': opponent?.primaryColor ?? '#667085',
    '--opponent-secondary': opponent?.secondaryColor ?? '#d0d5dd',
  } as CSSProperties;
  const isTrade = variant === 'trade' || variant === 'trade-rumor';

  return (
    <section
      className={`${styles.graphic} ${styles[size]} ${styles[variant] ?? ''} ${className}`}
      style={style}
      data-variant={variant}
      data-size={size}
    >
      {isTrade ? <div className={styles.tradeSplit} aria-hidden="true" /> : null}
      <div className={styles.content}>
        <div className={styles.eyebrow}>
          <i aria-hidden="true" />
          <span>{label ?? defaultLabel[variant]}</span>
        </div>

        {score && opponent ? (
          <div className={styles.score}>
            <span>{team?.abbreviation ?? 'TEAM'}</span>
            <strong>{score.team}</strong>
            <em>{score.status ?? 'FINAL'}</em>
            <strong>{score.opponent}</strong>
            <span>{opponent.abbreviation}</span>
          </div>
        ) : null}

        {isTrade && opponent ? (
          <div className={styles.abbreviations}>
            <strong>{team?.abbreviation ?? 'TEAM'}</strong>
            <span aria-hidden="true">⇄</span>
            <strong>{opponent.abbreviation}</strong>
          </div>
        ) : null}

        {player?.number != null ? <div className={styles.number}>{player.number}</div> : null}
        {player ? (
          <p className={styles.player}>
            {player.position ? `${player.position} · ` : ''}
            {player.name}
          </p>
        ) : null}
        <h2>{headline}</h2>
        {description ? <p className={styles.description}>{description}</p> : null}
        {stats.length ? (
          <div className={styles.stats}>
            {stats.slice(0, 4).map((stat) => (
              <span key={`${stat.label}-${stat.value}`}>
                <strong>{stat.value}</strong>
                <small>{stat.label}</small>
              </span>
            ))}
          </div>
        ) : null}
        {team ? <span className={styles.teamName}>{team.displayName} · D&amp;D</span> : null}
      </div>
    </section>
  );
}
