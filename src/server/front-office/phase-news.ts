import type { FranchiseSimulationState } from '@/types/front-office';
import type { PlayerRowDTO } from '@/types/player';
import type { NewFrontOfficeEvent } from './events-repository';

/** Phase stories describe existing standings, contracts and draft state, never invented moves. */
export function phaseNews(input: {
  saveId: string;
  teamAbbr: string;
  previous: FranchiseSimulationState;
  current: FranchiseSimulationState;
  roster?: PlayerRowDTO[];
}) {
  const { saveId, previous, current, roster = [] } = input;
  const events: NewFrontOfficeEvent[] = [];
  const add = (
    key: string,
    team: string,
    category: string,
    headline: string,
    summary: string,
    playerId: string | null = null,
  ) =>
    events.push({
      id: `foe:${saveId}:${current.season}:${key}`,
      dedupeKey: key,
      saveId,
      type: 'league_transaction',
      priority: 'normal',
      headline,
      summary,
      teamAbbr: team,
      relatedTeamAbbr: null,
      playerId,
      prospectId: null,
      tradeOfferId: null,
      simulationSeason: current.season,
      simulationWeek: current.currentWeek,
      simulationPhase: current.phase,
      actionUrl: null,
      expiresAt: null,
      metadata: {
        newsCategory: category,
        origin: 'SIMULATION',
        sourceEventId: key,
        isBreaking: false,
        teamIds: [team],
      },
    });
  const old = new Set((previous.playoffs?.games ?? []).filter((g) => g.played).map((g) => g.id));
  for (const game of current.playoffs?.games ?? []) {
    if (
      !game.played ||
      old.has(game.id) ||
      !game.winner ||
      game.winner === current.playoffs?.champion
    )
      continue;
    add(
      `postseason:${game.id}`,
      game.winner,
      'PLAYOFF RACE',
      `${game.winner} advances in the postseason`,
      `${game.winner} remains in contention after the latest playoff round. Its next matchup will be set by the simulated bracket.`,
    );
  }
  if (previous.phase === current.phase) return events;
  if (['offseason', 'resign_cut', 'free_agency', 'free_agency_open'].includes(current.phase)) {
    const expiring = roster
      .filter((p) => p.contractYearsRemaining <= 1)
      .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
    const teams = new Set<string>();
    for (const player of expiring) {
      const team = player.teamAbbr ?? player.currentTeamAbbr;
      if (!team || teams.has(team)) continue;
      teams.add(team);
      add(
        `contract-watch:${current.phase}:${player.id}`,
        team,
        'CONTRACT',
        `${player.firstName} ${player.lastName} leads ${team}'s contract watch`,
        `${player.firstName} ${player.lastName}, ${player.position}, has ${player.contractYearsRemaining} year${player.contractYearsRemaining === 1 ? '' : 's'} remaining in the saved roster. ${team} must weigh the veteran's role against its other roster needs. This is contract analysis, not a completed extension.`,
        player.id,
      );
      if (teams.size === 2) break;
    }
  }
  if (
    ['scouting_combine', 'draft', 'offseason'].includes(current.phase) &&
    current.draftOrder.length
  ) {
    const top = current.draftOrder.slice(0, 3);
    add(
      `draft-order:${current.phase}`,
      top[0],
      'DRAFT',
      `${top[0]} leads the projected draft order`,
      `${top.join(', ')} hold the first three places in the franchise's current draft order. Order and pick ownership can change before selections are made.`,
    );
  }
  return events;
}
