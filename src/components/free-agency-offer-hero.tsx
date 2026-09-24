'use client';

import { useState, type CSSProperties } from 'react';
import Image from 'next/image';
import PlayerTypeIcon from '@/components/player-type-icon';
import { getFrontOfficeTeamTheme } from '@/lib/team-theme-tokens';
import { TEAM_LIST } from '@/data/teams';
import { resolvePlayerRating } from '@/lib/team-overview';
import type { PlayerRowDTO } from '@/types/player';
import shared from './player-details-modal.module.css';
import styles from './free-agency-offer-hero.module.css';

export function FreeAgencyOfferHero({
  player,
  teamAbbr,
  previousTeamAbbr,
}: {
  player: PlayerRowDTO;
  teamAbbr?: string;
  previousTeamAbbr?: string | null;
}) {
  const [failedPhoto, setFailedPhoto] = useState(false);
  const associatedTeam = [previousTeamAbbr, player.teamAbbr, teamAbbr].find((abbr) =>
    TEAM_LIST.some((team) => team.abbr === abbr),
  );
  const accent = associatedTeam ? getFrontOfficeTeamTheme(associatedTeam).interactive : '#457b88';
  return (
    <section
      aria-label="Free agent player"
      className={`${shared.hero} ${styles.hero}`}
      style={{ '--player-accent': accent } as CSSProperties}
    >
      <span className={shared.positionWatermark} aria-hidden="true">
        {player.position}
      </span>
      <div className={`${shared.portrait} ${styles.portrait}`}>
        {player.headshotUrl && !failedPhoto ? (
          <Image
            src={player.headshotUrl}
            alt={`${player.firstName} ${player.lastName}`}
            width={420}
            height={420}
            unoptimized
            onError={() => setFailedPhoto(true)}
          />
        ) : (
          <div
            className={`${shared.initials} ${styles.initials}`}
            aria-label={`${player.firstName} ${player.lastName}`}
          >
            {player.firstName?.[0]}
            {player.lastName?.[0]}
          </div>
        )}
      </div>
      <div className={`${shared.identity} ${styles.identity}`}>
        <h3>
          <span>{player.firstName}</span>
          <strong>{player.lastName}</strong>
        </h3>
        <div className={shared.distinctions}>
          <PlayerTypeIcon player={player} />
        </div>
        <div className={shared.metadata}>
          <span>{player.position}</span>
          {player.age != null && <span>Age {player.age}</span>}
          {player.height && <span>{player.height}</span>}
          {player.weight != null && <span>{player.weight} lbs</span>}
        </div>
        <p className={shared.teamline}>Free Agent</p>
      </div>
      <div className={`${shared.overall} ${styles.overall}`}>
        <span>OVR</span>
        <strong className="front-office-stat-value">{resolvePlayerRating(player) ?? '—'}</strong>
      </div>
    </section>
  );
}
