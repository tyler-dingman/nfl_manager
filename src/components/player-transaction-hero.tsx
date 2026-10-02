'use client';
import Image from 'next/image';
import { useState } from 'react';
import PlayerTypeIcon from './player-type-icon';
import type { PlayerRowDTO } from '@/types/player';
import { gameDayHeroAsset } from '@/config/game-day-hero';
import { resolvePlayerRating } from '@/lib/team-overview';
import styles from './player-transaction.module.css';
export function PlayerTransactionHero({
  player,
  team,
  mode,
  description,
}: {
  player: PlayerRowDTO;
  team: string;
  mode: 'sign' | 'renegotiate' | 'release';
  description: string;
}) {
  const [failed, setFailed] = useState(false);
  const name = `${player.firstName} ${player.lastName}`;
  return (
    <section className={styles.hero}>
      <div
        className={styles.environment}
        style={{ backgroundImage: `url("${gameDayHeroAsset(team)}")` }}
        aria-hidden="true"
      />
      <span className={styles.position} aria-hidden="true">
        {player.position}
      </span>
      <div className={styles.portrait}>
        {player.headshotUrl && !failed ? (
          <Image
            src={player.headshotUrl}
            alt={name}
            width={500}
            height={500}
            unoptimized
            onError={() => setFailed(true)}
          />
        ) : (
          <span className={styles.initials}>
            {player.firstName?.[0]}
            {player.lastName?.[0]}
          </span>
        )}
      </div>
      <div className={styles.copy}>
        <p className={styles.eyebrow}>
          {mode === 'sign'
            ? 'FREE AGENT'
            : mode === 'release'
              ? 'ROSTER MOVE'
              : 'CONTRACT NEGOTIATION'}
        </p>
        <h2>
          {mode === 'sign'
            ? `Sign ${name}`
            : mode === 'release'
              ? `Release ${name}?`
              : `Re-Negotiate With ${name}`}
        </h2>
        <p className={styles.description}>{description}</p>
        <div className={styles.metadata}>
          <PlayerTypeIcon player={player} />
          <b>{player.position}</b>
          {player.age != null && <span>Age {player.age}</span>}
          {player.height && <span>{player.height}</span>}
          {player.weight != null && <span>{player.weight} lbs</span>}
        </div>
        {mode === 'sign' && <p className={styles.status}>Free Agent</p>}
      </div>
      <div className={styles.rating}>
        <span>OVR</span>
        <strong>{resolvePlayerRating(player) ?? '—'}</strong>
        <i />
      </div>
    </section>
  );
}
export function TransactionMetrics({
  items,
}: {
  items: { label: string; value: React.ReactNode; detail?: React.ReactNode }[];
}) {
  return (
    <dl className={styles.metrics}>
      {items.map((item) => (
        <div key={item.label}>
          <dt>{item.label}</dt>
          <dd>{item.value}</dd>
          {item.detail && <small>{item.detail}</small>}
        </div>
      ))}
    </dl>
  );
}
