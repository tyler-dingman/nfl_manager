import { createRng } from '@/lib/deterministic-rng';
import { computeTeamNeeds, resolvePlayerRating } from '@/lib/team-overview';
import type { PlayerRowDTO } from '@/types/player';
import type { TeamDTO } from '@/types/team';
import type { TradeTeamProfile } from '@/types/trade-offers';

const averageAge = (players: PlayerRowDTO[]) => {
  const ages = players.map((player) => player.age).filter((age): age is number => typeof age === 'number');
  if (ages.length === 0) return 27;
  return ages.reduce((sum, age) => sum + age, 0) / ages.length;
};

export const getTeamTradeProfile = (
  team: TeamDTO,
  roster: PlayerRowDTO[],
  capSpace: number,
  saveSeed = team.abbr,
): TradeTeamProfile => {
  const rng = createRng(`${saveSeed}:${team.abbr}:trade-profile`);
  const rosterAge = averageAge(roster);
  const resolvedRatings = roster
    .map((player) => resolvePlayerRating(player))
    .filter((rating): rating is number => rating !== null);
  const avgRating =
    resolvedRatings.length > 0
      ? resolvedRatings.reduce((sum, rating) => sum + rating, 0) / resolvedRatings.length
      : team.teamOverview;
  const needs = computeTeamNeeds(roster, 5);
  const contenderBias = team.teamOverview >= 85 ? 0.78 : team.teamOverview <= 77 ? 0.28 : 0.5;
  const rebuildBias = rosterAge <= 25.8 || team.teamOverview <= 77 ? 0.72 : 0.32;
  const capSensitive = capSpace < 8 ? 0.82 : capSpace < 18 ? 0.56 : 0.34;
  const needDriven = Math.min(0.88, 0.42 + needs.length * 0.08);
  const aggressive = Math.min(0.9, 0.32 + rng() * 0.28 + contenderBias * 0.26);
  const conservative = Math.min(0.9, 0.24 + rng() * 0.3 + capSensitive * 0.22);
  const prefersPicks = Math.min(0.92, 0.28 + rebuildBias * 0.44 + rng() * 0.12);
  const prefersVeterans = Math.min(0.88, 0.22 + contenderBias * 0.42 + rng() * 0.12);
  const futurePickTolerance = Math.min(0.9, 0.24 + rebuildBias * 0.24 + aggressive * 0.2 + rng() * 0.1);
  const overpayForStars = Math.min(0.86, 0.18 + aggressive * 0.32 + contenderBias * 0.26 + (avgRating < 74 ? 0.06 : 0));

  return {
    teamAbbr: team.abbr,
    aggressive: Number(aggressive.toFixed(3)),
    conservative: Number(conservative.toFixed(3)),
    winNow: Number(contenderBias.toFixed(3)),
    rebuilding: Number(rebuildBias.toFixed(3)),
    capSensitive: Number(capSensitive.toFixed(3)),
    needDriven: Number(needDriven.toFixed(3)),
    prefersPicks: Number(prefersPicks.toFixed(3)),
    prefersVeterans: Number(prefersVeterans.toFixed(3)),
    futurePickTolerance: Number(futurePickTolerance.toFixed(3)),
    overpayForStars: Number(overpayForStars.toFixed(3)),
  };
};
