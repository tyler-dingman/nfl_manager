import { TEAM_LIST } from '@/data/teams';
import { resolvePlayerRating } from '@/lib/team-overview';
import {
  getOrBuildProjectedRosterForTeam,
  getProjectedCapSpaceForTeam,
  getTradableDraftPicksForTeam,
  type SaveState,
} from '@/server/api/store';
import { buildTradeBlock } from '@/server/logic/trade-block';
import type { FranchiseSimulationState } from '@/types/front-office';
import type { PlayerRowDTO } from '@/types/player';

export type TradeTarget = PlayerRowDTO & {
  tradeAvailabilityScore: number;
  tradeValueScore: number;
  estimatedCost: string;
  availabilityLabel: string;
  whyAvailable: string[];
  depthPosition: number | null;
  contractSummary: string;
};

export type TradeTeamOutlook = {
  teamAbbr: string;
  record: string;
  capSpace: number;
  score: number;
  label: 'Likely Seller' | 'Possible Seller' | 'Neutral' | 'Possible Buyer' | 'Likely Buyer';
};

const POSITION_MULTIPLIER: Record<string, number> = {
  QB: 1.5,
  EDGE: 1.25,
  DE: 1.25,
  OT: 1.2,
  LT: 1.2,
  RT: 1.2,
  CB: 1.15,
  WR: 1.1,
  DT: 1.05,
  DL: 1.05,
  LB: 0.95,
  S: 0.95,
  TE: 0.9,
  RB: 0.75,
};

const clamp = (value: number) => Math.max(0, Math.min(100, Math.round(value)));
const recordFor = (simulation: FranchiseSimulationState | null, abbr: string) =>
  simulation?.teams[abbr]?.record ?? { wins: 0, losses: 0, ties: 0 };

export function estimateTradeCost(score: number) {
  if (score >= 88) return '1st Rd';
  if (score >= 72) return '2nd Rd';
  if (score >= 58) return '3rd Rd';
  if (score >= 45) return '4th + 6th';
  return 'Day 3 Pick';
}

export function buildTradeTargets(
  state: SaveState,
  simulation: FranchiseSimulationState | null,
  userTeamAbbr: string,
): TradeTarget[] {
  return buildTradeBlock(state, userTeamAbbr)
    .map((player) => {
      const rating = resolvePlayerRating(player) ?? 60;
      const years = player.contract?.yearsRemaining ?? player.contractYearsRemaining ?? 1;
      const age = player.age ?? 27;
      const teamRecord = recordFor(simulation, player.teamAbbr ?? '');
      const games = teamRecord.wins + teamRecord.losses + teamRecord.ties;
      const losingRate = games ? teamRecord.losses / games : 0.5;
      const capSpace = getProjectedCapSpaceForTeam(state, player.teamAbbr ?? '');
      const finalYear = years <= 1 ? 18 : 0;
      const veteranExpiry = years <= 1 && age >= 29 ? 8 : 0;
      const capPressure = capSpace < 8 ? 8 : 0;
      const depth = player.currentDepthRank ?? 1;
      const depthBonus = depth > 1 ? 8 : 0;
      const strongBackup = depth > 1 && rating >= 78 ? 8 : 0;
      const sellerBonus = losingRate >= 0.6 ? 15 : losingRate >= 0.5 ? 8 : 0;
      const availability = clamp(
        16 +
          player.tradeBlockScore * 0.55 +
          finalYear +
          veteranExpiry +
          capPressure +
          depthBonus +
          strongBackup +
          sellerBonus,
      );
      const multiplier = POSITION_MULTIPLIER[player.position.toUpperCase()] ?? 0.85;
      const youth = age <= 25 ? 1.15 : age >= 30 ? 0.78 : 1;
      const contract = years >= 3 ? 1.08 : years === 1 ? 0.9 : 1;
      const value = clamp(((rating - 55) / 35) * 100 * multiplier * youth * contract);
      const why = [player.tradeBlockReason];
      if (finalYear) why.push('Final year of contract');
      if (depth > 1) why.push(`Currently No. ${depth} on the depth chart`);
      if (sellerBonus) why.push(`${player.teamAbbr} is outside the strongest competitive tier`);
      if (capPressure) why.push('Team is operating with limited cap flexibility');
      return {
        ...player,
        tradeAvailabilityScore: availability,
        tradeValueScore: value,
        estimatedCost: estimateTradeCost(value),
        availabilityLabel:
          availability >= 81
            ? 'Actively shopped'
            : availability >= 61
              ? 'Available'
              : availability >= 41
                ? 'Possible'
                : availability >= 21
                  ? 'Unlikely'
                  : 'Almost untouchable',
        whyAvailable: [...new Set(why)].slice(0, 4),
        depthPosition: player.currentDepthRank,
      };
    })
    .sort(
      (a, b) =>
        b.tradeAvailabilityScore - a.tradeAvailabilityScore ||
        b.tradeValueScore - a.tradeValueScore,
    );
}

export function buildTradeTeamOutlooks(
  state: SaveState,
  simulation: FranchiseSimulationState | null,
): TradeTeamOutlook[] {
  const week = simulation?.currentWeek ?? 1;
  return TEAM_LIST.map((team) => {
    const record = recordFor(simulation, team.abbr);
    const games = record.wins + record.losses + record.ties;
    const winPct = games ? (record.wins + record.ties * 0.5) / games : 0.5;
    const capSpace = getProjectedCapSpaceForTeam(state, team.abbr);
    const deadlineMultiplier = week >= 8 ? 1.2 : week >= 5 ? 1.08 : 1;
    const score = clamp(
      (50 + (winPct - 0.5) * 70 + Math.min(15, capSpace / 2)) * deadlineMultiplier,
    );
    const label =
      score >= 72
        ? 'Likely Buyer'
        : score >= 58
          ? 'Possible Buyer'
          : score <= 30
            ? 'Likely Seller'
            : score <= 44
              ? 'Possible Seller'
              : 'Neutral';
    return {
      teamAbbr: team.abbr,
      record: `${record.wins}-${record.losses}${record.ties ? `-${record.ties}` : ''}`,
      capSpace,
      score,
      label,
    };
  });
}

export function getUserTradeChips(state: SaveState, teamAbbr: string) {
  return getTradableDraftPicksForTeam(state, teamAbbr)
    .sort((a, b) => a.year - b.year || a.round - b.round)
    .slice(0, 4)
    .map((pick) => ({
      id: pick.id,
      label: `${pick.year} ${['', '1st', '2nd', '3rd'][pick.round] ?? `${pick.round}th`} Rd`,
    }));
}
