import type { DefenseContext } from './market-defense-mapping';
import { defenseContextLabel } from './market-defense-mapping';
import type { TeamSeasonStrength } from './types';

export const matchupLabelForRank = (rank: number) =>
  rank <= 8
    ? 'Tough matchup'
    : rank <= 16
      ? 'Solid matchup'
      : rank <= 24
        ? 'Favorable matchup'
        : 'Very favorable matchup';

export function buildUpcomingMatchup(
  opponentTeamId: string,
  opponentName: string,
  context: DefenseContext,
  strength: TeamSeasonStrength,
) {
  const detail =
    context === 'PASS'
      ? {
          rank: strength.passDefenseRank,
          metricName: 'Pass yds allowed / game',
          metricValue: strength.passingYardsAllowedPerGame,
        }
      : context === 'RUSH'
        ? {
            rank: strength.rushDefenseRank,
            metricName: 'Rush yds allowed / game',
            metricValue: strength.rushingYardsAllowedPerGame,
          }
        : context === 'SCORING'
          ? {
              rank: strength.scoringDefenseRank,
              metricName: 'Points allowed / game',
              metricValue: strength.pointsAllowedPerGame,
            }
          : {
              rank: strength.totalDefenseRank,
              metricName: 'Total yds allowed / game',
              metricValue: strength.totalYardsAllowedPerGame,
            };

  return {
    opponentTeamId,
    opponentAbbreviation: opponentTeamId,
    opponentName,
    relevantDefenseType: context,
    defenseLabel: defenseContextLabel(context),
    defenseSeason: strength.season,
    defenseRank: detail.rank,
    relevantMetricName: detail.metricName,
    relevantMetricValue: detail.metricValue,
    matchupLabel: matchupLabelForRank(detail.rank),
  };
}
