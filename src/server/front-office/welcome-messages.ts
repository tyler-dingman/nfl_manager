import type { PlayerRowDTO } from '@/types/player';
import type { FrontOfficeSaveMetadata } from '@/types/front-office';
import type { NewFrontOfficeEvent } from './events-repository';

// Current for the 2026 season. This is the canonical coach source for Front Office saves;
// quarterbacks intentionally come from each save's roster instead of a second static list.
export const NFL_HEAD_COACHES_2026: Record<string, string> = {
  ARI: 'Mike LaFleur',
  ATL: 'Kevin Stefanski',
  BAL: 'Jesse Minter',
  BUF: 'Joe Brady',
  CAR: 'Dave Canales',
  CHI: 'Ben Johnson',
  CIN: 'Zac Taylor',
  CLE: 'Todd Monken',
  DAL: 'Brian Schottenheimer',
  DEN: 'Sean Payton',
  DET: 'Dan Campbell',
  GB: 'Matt LaFleur',
  HOU: 'DeMeco Ryans',
  IND: 'Shane Steichen',
  JAX: 'Liam Coen',
  KC: 'Andy Reid',
  LV: 'Klint Kubiak',
  LAC: 'Jim Harbaugh',
  LAR: 'Sean McVay',
  MIA: 'Jeff Hafley',
  MIN: "Kevin O'Connell",
  NE: 'Mike Vrabel',
  NO: 'Kellen Moore',
  NYG: 'John Harbaugh',
  NYJ: 'Aaron Glenn',
  PHI: 'Nick Sirianni',
  PIT: 'Mike McCarthy',
  SF: 'Kyle Shanahan',
  SEA: 'Mike Macdonald',
  TB: 'Todd Bowles',
  TEN: 'Robert Saleh',
  WAS: 'Dan Quinn',
};

const rating = (player: PlayerRowDTO) =>
  player.rating ?? player.maddenRating ?? player.baselineRating ?? 0;

export function resolveStartingQuarterback(roster: PlayerRowDTO[]) {
  return (
    roster
      .filter((player) => player.position.toUpperCase() === 'QB')
      .sort((a, b) => rating(b) - rating(a))[0] ?? null
  );
}

export function buildWeekOneWelcomeEvents(
  save: FrontOfficeSaveMetadata,
  roster: PlayerRowDTO[],
): NewFrontOfficeEvent[] {
  const week = Math.max(1, save.simulation?.currentWeek ?? 1);
  if (save.selectedPath !== 'full' || save.season !== 2026 || week !== 1) return [];
  const teamAbbr = save.teamAbbr.toUpperCase() === 'WSH' ? 'WAS' : save.teamAbbr.toUpperCase();
  const coach = NFL_HEAD_COACHES_2026[teamAbbr];
  const quarterback = resolveStartingQuarterback(roster);
  const common = {
    saveId: save.saveId,
    type: 'welcome_message' as const,
    priority: 'normal' as const,
    teamAbbr,
    relatedTeamAbbr: null,
    prospectId: null,
    tradeOfferId: null,
    simulationSeason: 2026,
    simulationWeek: 1,
    simulationPhase: 'week-1',
    actionUrl: null,
    expiresAt: null,
  };
  const events: NewFrontOfficeEvent[] = [];
  if (coach) {
    events.push({
      ...common,
      id: `welcome:${save.saveId}:coach`,
      dedupeKey: 'welcome:head-coach',
      headline: coach,
      summary: "Let's get off to a fast start!",
      playerId: null,
      metadata: {
        channel: 'MESSAGE',
        senderType: 'HEAD_COACH',
        senderName: coach,
        senderRole: 'Head Coach',
        messageOrder: 1,
      },
    });
  } else if (process.env.NODE_ENV !== 'test') {
    console.warn(
      `[Front Office] No 2026 head coach resolved for ${teamAbbr}; welcome message skipped.`,
    );
  }
  if (quarterback) {
    const senderName = `${quarterback.firstName} ${quarterback.lastName}`.trim();
    events.push({
      ...common,
      id: `welcome:${save.saveId}:qb`,
      dedupeKey: 'welcome:starting-qb',
      headline: senderName,
      summary: "Excited to get this season going. Let's make it a great one!",
      playerId: quarterback.id,
      metadata: {
        channel: 'MESSAGE',
        senderType: 'PLAYER',
        senderName,
        senderRole: 'Starting QB',
        headshotUrl: quarterback.headshotUrl ?? null,
        messageOrder: 2,
      },
    });
  } else if (process.env.NODE_ENV !== 'test') {
    console.warn(
      `[Front Office] No starting QB resolved for ${teamAbbr}; welcome message skipped.`,
    );
  }
  return events;
}
