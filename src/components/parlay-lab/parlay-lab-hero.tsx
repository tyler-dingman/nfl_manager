'use client';
import { labScoreColor } from '../../../packages/parlay/lab-score-config';

import { selectHeroProps } from '../../../packages/parlay/hero-selection';
export { selectHeroProps } from '../../../packages/parlay/hero-selection';
import { useDiscoveryPreferences } from './use-discovery-preferences';
import { labScoreBand } from '../../../packages/parlay/lab-score-config';
import { marketDisplayName } from '@/lib/parlay-lab/market-display';
import { EditorialSectionHero } from '@/components/beat/editorial-section-hero';
import shared from '@/components/beat/beat-hero.module.css';
import { TEAM_LIST } from '@/data/teams';
import type { HomeMarket } from './ParlayLabHome';
import { LabStatsIcon, LabExperimentIcon } from './lab-icons';
import { Globe } from 'lucide-react';
import PlayerAvatar from './PlayerAvatar';
import styles from './parlay-lab-hero.module.css';

export function ParlayLabHero({
  teamAbbr,
  markets,
  events,
  onOpen,
  dashboard = false,
}: {
  dashboard?: boolean;
  teamAbbr: string;
  markets: HomeMarket[];
  events: { id: string; kickoffAt: string }[];
  onOpen: (market: HomeMarket) => void;
}) {
  const team = TEAM_LIST.find((t) => t.abbr === teamAbbr);
  const preferences = useDiscoveryPreferences();
  const props = preferences.ready
    ? selectHeroProps(markets, teamAbbr, events, Date.now(), preferences)
    : [];
  return (
    <EditorialSectionHero
      teamAbbr={teamAbbr}
      variant="parlay-lab"
      identityExtra={
        dashboard ? (
          <div className="lab-values">
            <div>
              <LabStatsIcon />
              <b>DATA-DRIVEN INSIGHTS</b>
              <p>Find edges with real trends.</p>
            </div>
            <div>
              <Globe />
              <b>ALL 32 TEAMS</b>
              <p>Research every game, player and market.</p>
            </div>
            <div>
              <LabExperimentIcon />
              <b>BUILD BETTER</b>
              <p>Turn insights into smarter parlays.</p>
            </div>
          </div>
        ) : undefined
      }
      firstWord="PARLAY"
      accentWord="LAB"
      taglineLabel="Your playbook for building smarter parlays."
      tagline={
        <>
          YOUR PLAYBOOK FOR <tspan className={shared.nickname}>BUILDING SMARTER PARLAYS.</tspan>
        </>
      }
    >
      <h2 className={`dd-three-out-display ${shared.threeTitle}`}>
        {team?.city.toUpperCase() ?? 'TEAM'} <span className="dd-three-out-ampersand">PROPS</span>
      </h2>
      <p className={shared.subtitle}>CERTIFIED LAB FINDS</p>
      <ol className={styles.list}>
        {props.map((m, i) => (
          <li key={`${m.id}:${m.sportsbook}`}>
            <button className={styles.row} onClick={() => onOpen(m)}>
              <span className={shared.number}>{String(i + 1).padStart(2, '0')}</span>
              <span className={styles.avatar}>
                <PlayerAvatar
                  name={m.playerName}
                  headshotUrl={m.headshotUrl}
                  teamColor={team?.colors[0]}
                  size={38}
                  transparent
                />
              </span>
              <span className={styles.player}>
                <b>{m.playerName}</b>
                <small>{m.position}</small>
              </span>
              <span className={styles.prop}>
                <b>
                  {m.side === 'OVER' ? 'O' : m.side === 'UNDER' ? 'U' : m.side} {m.line}
                </b>
                <small>
                  {marketDisplayName(m.marketType === 'OTHER' ? m.statId : m.marketType)}
                  {m.lineType === 'alternate' ? ' · ALT LINE' : ''}
                </small>
              </span>
              <span className={styles.score}>
                <small>LAB SCORE</small>
                <b style={{ color: labScoreColor(m.trend!.trendScore) }}>{m.trend!.trendScore}</b>
                <small>{labScoreBand(m.trend!.trendScore).label}</small>
              </span>
            </button>
          </li>
        ))}
      </ol>
      {!props.length && (
        <p className={styles.empty}>
          No {team?.city ?? 'team'} props currently meet the Lab Find requirements. Browse All Props
          for scored research.
        </p>
      )}
      <p className={`${shared.meta} ${styles.disclaimer}`}>
        FOR INFORMATIONAL PURPOSES ONLY · PLEASE GAMBLE RESPONSIBLY
      </p>
    </EditorialSectionHero>
  );
}
