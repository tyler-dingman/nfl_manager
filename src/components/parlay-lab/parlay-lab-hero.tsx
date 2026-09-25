'use client';
import { marketDisplayName } from '@/lib/parlay-lab/market-display';
import { EditorialSectionHero } from '@/components/beat/editorial-section-hero';
import shared from '@/components/beat/beat-hero.module.css';
import { TEAM_LIST } from '@/data/teams';
import type { HomeMarket } from './ParlayLabHome';
import { LabStatsIcon, LabExperimentIcon } from './lab-icons';
import { DdTeamAnalyticsIcon } from '@/components/ui/football-icons';
import PlayerAvatar from './PlayerAvatar';
import styles from './parlay-lab-hero.module.css';

export function selectHeroProps(
  markets: HomeMarket[],
  teamAbbr: string,
  events: { id: string; kickoffAt: string }[],
  now = Date.now(),
) {
  const upcoming = new Set(events.filter((e) => Date.parse(e.kickoffAt) > now).map((e) => e.id));
  const unique = new Map<string, HomeMarket>();
  for (const m of markets) {
    const score = m.trend?.trendScore;
    if (
      !m.available ||
      m.teamId !== teamAbbr ||
      !m.playerId ||
      !m.playerName ||
      m.line == null ||
      !Number.isFinite(m.line) ||
      score == null ||
      !Number.isFinite(score) ||
      score < 0 ||
      score > 100 ||
      !m.eventId ||
      !upcoming.has(m.eventId)
    )
      continue;
    const key = `${m.eventId}:${m.normalizedKey}`;
    const old = unique.get(key);
    if (!old || score > (old.trend?.trendScore ?? -1)) unique.set(key, m);
  }
  const ranked = [...unique.values()].sort((a, b) => b.trend!.trendScore - a.trend!.trendScore);
  const selected: HomeMarket[] = [];
  const players = new Set<string>();
  for (const m of ranked) {
    if (players.has(m.playerId!)) continue;
    selected.push(m);
    players.add(m.playerId!);
    if (selected.length === 3) break;
  }
  for (const m of ranked) {
    if (selected.length === 3) break;
    if (!selected.includes(m)) selected.push(m);
  }
  return selected.sort((a, b) => b.trend!.trendScore - a.trend!.trendScore);
}

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
  const props = selectHeroProps(markets, teamAbbr, events);
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
              <DdTeamAnalyticsIcon />
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
                </small>
              </span>
              <span className={styles.score}>
                <small>LAB SCORE</small>
                <b>{m.trend!.trendScore}</b>
              </span>
            </button>
          </li>
        ))}
      </ol>
      {!props.length && (
        <p className={styles.empty}>
          No scored player props are currently available for {team?.city ?? 'your team'}.
        </p>
      )}
      <p className={`${shared.meta} ${styles.disclaimer}`}>
        FOR INFORMATIONAL PURPOSES ONLY · PLEASE GAMBLE RESPONSIBLY
      </p>
    </EditorialSectionHero>
  );
}
