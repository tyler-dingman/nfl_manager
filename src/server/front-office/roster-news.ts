import type { PlayerRowDTO } from '@/types/player';
import type { FranchiseSimulationState } from '@/types/front-office';
import type { NewFrontOfficeEvent } from './events-repository';
export type NewsRosterObservation = {
  name: string;
  team: string;
  position: string;
  status: string;
  rating: number;
};
/** Observe actual roster state; never simulate an injury, promotion or return merely to fill news. */
export function rosterChangeNews(
  saveId: string,
  previous: FranchiseSimulationState,
  current: FranchiseSimulationState,
  roster: PlayerRowDTO[],
) {
  const snapshot: Record<string, NewsRosterObservation> = {};
  const events: NewFrontOfficeEvent[] = [];
  for (const p of roster) {
    const team = p.teamAbbr ?? p.currentTeamAbbr;
    if (!team) continue;
    const next = {
      name: `${p.firstName} ${p.lastName}`,
      team,
      position: p.position,
      status: p.status ?? '',
      rating: p.rating ?? p.maddenRating ?? 70,
    };
    snapshot[p.id] = next;
    const before = previous.newsRosterSnapshot?.[p.id];
    if (!before) continue;
    const injured = (s: string) => /injur|out\b|injured.reserve|questionable|doubtful/i.test(s);
    let category = '',
      headline = '',
      summary = '';
    if (!injured(before.status) && injured(next.status)) {
      category = 'INJURY';
      headline = `${next.name} added to ${team}'s injury report`;
      summary = `The ${next.position} is now listed as ${next.status}. This status comes from the saved franchise roster.`;
    } else if (injured(before.status) && !injured(next.status)) {
      category = 'RETURN';
      headline = `${next.name} clears ${team}'s injury designation`;
      summary = `The saved roster now lists the ${next.position} as ${next.status || 'available'}.`;
    } else if (!/starter/i.test(before.status) && /starter/i.test(next.status)) {
      category = 'DEPTH CHART';
      headline = `${next.name} moves into a starting role for ${team}`;
      summary = `The ${next.position}'s saved roster designation changed from ${before.status} to ${next.status}.`;
    } else if (next.rating - before.rating >= 2) {
      category = 'PERFORMANCE';
      headline = `${next.name} improves to ${next.rating} OVR`;
      summary = `The ${team} ${next.position} gained ${next.rating - before.rating} rating points since the previous roster snapshot.`;
    }
    if (category) {
      const key = `roster:${p.id}:${current.currentWeek}:${category}`;
      events.push({
        id: `foe:${saveId}:${current.season}:${key}`,
        dedupeKey: key,
        saveId,
        type: 'league_transaction',
        priority: category === 'INJURY' && next.rating >= 85 ? 'high' : 'normal',
        headline,
        summary,
        teamAbbr: team,
        relatedTeamAbbr: null,
        playerId: p.id,
        prospectId: null,
        tradeOfferId: null,
        simulationSeason: current.season,
        simulationWeek: Math.max(1, current.currentWeek),
        simulationPhase: current.phase,
        actionUrl: null,
        expiresAt: null,
        metadata: {
          origin: 'SIMULATION',
          sourceEventId: key,
          newsCategory: category,
          isBreaking: false,
        },
      });
    }
  }
  current.newsRosterSnapshot = snapshot;
  return events;
}
