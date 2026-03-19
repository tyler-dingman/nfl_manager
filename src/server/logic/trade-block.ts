import { TEAM_LIST } from '@/data/teams';
import { createRng } from '@/lib/deterministic-rng';
import { computeTeamNeeds, normalizeOverviewPosition, resolvePlayerRating } from '@/lib/team-overview';
import {
  getOrBuildProjectedRosterForTeam,
  getProjectedCapSpaceForTeam,
  type SaveState,
} from '@/server/api/store';
import type { PlayerRowDTO } from '@/types/player';
import type { TradeBlockCategory, TradeBlockRow } from '@/types/trade-block';

type TradePosition = 'QB' | 'RB' | 'WR' | 'TE' | 'OT' | 'IOL' | 'EDGE' | 'DL' | 'LB' | 'CB' | 'S';

type RatedPlayer = PlayerRowDTO & {
  teamAbbr: string;
  resolvedRating: number;
};

type TeamContext = {
  capSpace: number;
  needs: TradePosition[];
  roomStrength: Map<TradePosition, number>;
  ratedByPosition: Map<TradePosition, RatedPlayer[]>;
};

type CandidateContext = {
  player: RatedPlayer;
  depthRank: number;
  starterCount: number;
  room: RatedPlayer[];
  teamCapSpace: number;
};

type ScoreContribution = {
  category: TradeBlockCategory;
  score: number;
  reason: string;
};

const STARTER_COUNT_BY_POSITION: Record<TradePosition, number> = {
  QB: 1,
  RB: 2,
  WR: 3,
  TE: 1,
  OT: 2,
  IOL: 3,
  EDGE: 2,
  DL: 2,
  LB: 3,
  CB: 3,
  S: 2,
};

const MAX_PLAYERS_PER_TEAM = 3;
const MAX_PLAYERS_PER_POSITION: Record<TradePosition, number> = {
  QB: 5,
  RB: 6,
  WR: 8,
  TE: 5,
  OT: 7,
  IOL: 7,
  EDGE: 8,
  DL: 8,
  LB: 7,
  CB: 8,
  S: 6,
};
const TOTAL_TRADE_BLOCK_SIZE = 60;

const POSITION_FIT_KEYS = new Set<TradePosition>([
  'QB',
  'RB',
  'WR',
  'TE',
  'OT',
  'IOL',
  'EDGE',
  'DL',
  'LB',
  'CB',
  'S',
]);

const normalizeTradePosition = (position: string): TradePosition | null => {
  const bucket = normalizeOverviewPosition(position);

  if (bucket === 'QB') return 'QB';
  if (bucket === 'RB') return 'RB';
  if (bucket === 'WR') return 'WR';
  if (bucket === 'TE') return 'TE';
  if (bucket === 'LT' || bucket === 'RT') return 'OT';
  if (bucket === 'LG' || bucket === 'C' || bucket === 'RG') return 'IOL';
  if (bucket === 'EDGE') return 'EDGE';
  if (bucket === 'DL') return 'DL';
  if (bucket === 'LB') return 'LB';
  if (bucket === 'CB') return 'CB';
  if (bucket === 'S') return 'S';

  return null;
};

const average = (values: number[]): number =>
  values.length === 0 ? 55 : values.reduce((sum, value) => sum + value, 0) / values.length;

const formatContractSummary = (player: PlayerRowDTO) => {
  const years = Math.max(1, player.contract?.yearsRemaining ?? player.contractYearsRemaining ?? 1);
  const value =
    player.contract?.apy ??
    player.salary ??
    player.capHitValue ??
    (typeof player.capHit === 'string' ? Number(player.capHit.replace(/[^0-9.]/g, '')) : null) ??
    0;
  const formatted = Math.abs(value - Math.round(value)) < 0.05 ? Math.round(value) : value;
  return `${years} yr · $${formatted.toFixed(1)}M`;
};

const buildRatedRoster = (players: PlayerRowDTO[], teamAbbr: string): RatedPlayer[] =>
  players
    .map((player) => {
      const resolvedRating = resolvePlayerRating(player);
      if (resolvedRating === null) return null;

      return {
        ...player,
        teamAbbr,
        resolvedRating,
      };
    })
    .filter((player): player is RatedPlayer => player !== null && player.status.toLowerCase() !== 'cut');

const buildTeamContext = (state: SaveState): Map<string, TeamContext> => {
  const context = new Map<string, TeamContext>();

  TEAM_LIST.forEach((team) => {
    const roster = buildRatedRoster(getOrBuildProjectedRosterForTeam(state, team.abbr), team.abbr);
    const ratedByPosition = new Map<TradePosition, RatedPlayer[]>();

    roster.forEach((player) => {
      const position = normalizeTradePosition(player.position);
      if (!position) return;
      const room = ratedByPosition.get(position) ?? [];
      room.push(player);
      ratedByPosition.set(position, room);
    });

    ratedByPosition.forEach((room) => room.sort((left, right) => right.resolvedRating - left.resolvedRating));

    const roomStrength = new Map<TradePosition, number>();
    ratedByPosition.forEach((room, position) => {
      const starters = room
        .slice(0, STARTER_COUNT_BY_POSITION[position])
        .map((player) => player.resolvedRating);
      const padded = [
        ...starters,
        ...Array.from(
          { length: Math.max(0, STARTER_COUNT_BY_POSITION[position] - starters.length) },
          () => 55,
        ),
      ];
      roomStrength.set(position, average(padded));
    });

    const needs = computeTeamNeeds(roster, 6).filter((need): need is TradePosition =>
      POSITION_FIT_KEYS.has(need as TradePosition),
    );

    context.set(team.abbr, {
      capSpace: getProjectedCapSpaceForTeam(state, team.abbr),
      needs,
      roomStrength,
      ratedByPosition,
    });
  });

  return context;
};

const getStarterCount = (position: TradePosition) => STARTER_COUNT_BY_POSITION[position];

const isUntouchable = ({ player, depthRank, starterCount }: CandidateContext) => {
  const yearsRemaining = player.contract?.yearsRemaining ?? player.contractYearsRemaining ?? 0;

  if (player.position === 'QB' && depthRank === 1 && player.resolvedRating >= 80) return true;
  if (depthRank <= starterCount && player.resolvedRating >= 90) return true;
  if (depthRank <= starterCount + 1 && yearsRemaining >= 3 && player.resolvedRating >= 82) {
    return true;
  }
  if ((player.age ?? 30) <= 25 && yearsRemaining >= 2 && player.resolvedRating >= 80) {
    return true;
  }
  if (
    depthRank <= starterCount + 1 &&
    (player.age ?? 30) <= 24 &&
    yearsRemaining >= 2 &&
    player.resolvedRating >= 76
  ) {
    return true;
  }
  if ((player.age ?? 30) <= 24 && yearsRemaining >= 3 && player.resolvedRating >= 80) {
    return true;
  }
  if (depthRank <= starterCount && player.age !== undefined && player.age <= 26 && yearsRemaining >= 2 && player.resolvedRating >= 84) {
    return true;
  }
  if (depthRank <= starterCount && player.capHitValue !== undefined && player.capHitValue <= 2 && player.resolvedRating >= 78 && (player.age ?? 30) <= 27) {
    return true;
  }

  return false;
};

const scoreCandidate = (input: CandidateContext): ScoreContribution[] => {
  const { player, depthRank, starterCount, room, teamCapSpace } = input;
  const yearsRemaining = player.contract?.yearsRemaining ?? player.contractYearsRemaining ?? 0;
  const age = player.age ?? 28;
  const capHit = player.capHitValue ?? player.contract?.capHit ?? player.salary ?? 0;
  const starterThreshold = room[Math.max(0, starterCount - 1)]?.resolvedRating ?? 70;
  const topStarter = room[0];
  const surplusCount = room.filter((item) => item.resolvedRating >= 74).length;
  const contributions: ScoreContribution[] = [];

  if (depthRank > starterCount) {
    const buriedScore = 13 + Math.max(0, player.resolvedRating - 68) * 0.45;
    contributions.push({
      category: 'buried_depth',
      score: buriedScore,
      reason: 'Buried on Depth Chart',
    });
  }

  if (
    player.position === 'QB' &&
    depthRank > 1 &&
    topStarter &&
    (topStarter.age ?? 26) <= 28 &&
    topStarter.resolvedRating >= player.resolvedRating + 4 &&
    age >= 28
  ) {
    contributions.push({
      category: 'buried_depth',
      score: 12,
      reason: 'Buried on Depth Chart',
    });
  }

  if (yearsRemaining === 1 && age >= 29) {
    contributions.push({
      category: 'veteran_expiring',
      score: 8 + Math.max(0, player.resolvedRating - 70) * 0.35,
      reason: 'Cap Casualty',
    });
  }

  if (yearsRemaining === 1 && age <= 25 && player.resolvedRating >= 70) {
    contributions.push({
      category: 'young_expiring',
      score: 8 + Math.max(0, player.resolvedRating - 70) * 0.4,
      reason: 'Expiring Young Talent',
    });
  }

  if (surplusCount > starterCount && depthRank >= Math.max(2, starterCount)) {
    contributions.push({
      category: 'surplus',
      score: 7 + (surplusCount - starterCount) * 2,
      reason: 'Buried on Depth Chart',
    });
  }

  if (depthRank > 1 && player.resolvedRating >= starterThreshold - 3 && player.resolvedRating >= 72) {
    contributions.push({
      category: 'role_redundancy',
      score: 6,
      reason: 'Buried on Depth Chart',
    });
  }

  if (teamCapSpace < 5 && (capHit >= 4 || (age >= 29 && capHit >= 2.5))) {
    contributions.push({
      category: 'cap_pressure',
      score: Math.max(5, (5 - teamCapSpace) * 0.8 + Math.max(0, capHit - 3)),
      reason: 'Cap Casualty',
    });
  }

  if (age >= 30 && capHit >= 6 && player.resolvedRating <= 78) {
    contributions.push({
      category: 'cap_pressure',
      score: 4,
      reason: 'Cap Casualty',
    });
  }

  return contributions;
};

const buildPotentialFits = (
  state: SaveState,
  player: RatedPlayer,
  playerPosition: TradePosition,
  teamContext: Map<string, TeamContext>,
  userTeamAbbr: string,
): string[] => {
  const starterCount = getStarterCount(playerPosition);

  return TEAM_LIST.map((team) => {
    if (team.abbr === player.teamAbbr) return null;

    const context = teamContext.get(team.abbr);
    if (!context) return null;

    const needIndex = context.needs.indexOf(playerPosition);
    const roomStrength = context.roomStrength.get(playerPosition) ?? 55;
    const room = context.ratedByPosition.get(playerPosition) ?? [];
    const missingStarters = Math.max(0, starterCount - room.length);
    const capSpace = getProjectedCapSpaceForTeam(state, team.abbr);
    let score = 0;

    if (needIndex >= 0) {
      score += 30 - needIndex * 5;
    }

    score += Math.max(0, 82 - roomStrength) * 1.1;
    score += missingStarters * 8;

    if (capSpace > 15) score += 10;
    else if (capSpace > 5) score += 7;
    else if (capSpace >= 0) score += 3;
    else if (capSpace < -5) score -= 14;
    else score -= 7;

    if (roomStrength >= 86 && needIndex === -1) {
      score -= 18;
    }

    const fitRng = createRng(
      `${state.header.id}:${state.header.phase}:${player.id}:${team.abbr}:${playerPosition}`,
    );
    score += fitRng() * 3;

    if (score < 14) return null;

    return { abbr: team.abbr, score };
  })
    .filter((entry): entry is { abbr: string; score: number } => entry !== null)
    .sort((left, right) => {
      const leftIsUserTeam = left.abbr === userTeamAbbr ? 1 : 0;
      const rightIsUserTeam = right.abbr === userTeamAbbr ? 1 : 0;
      if (leftIsUserTeam !== rightIsUserTeam) {
        return rightIsUserTeam - leftIsUserTeam;
      }
      return right.score - left.score || left.abbr.localeCompare(right.abbr);
    })
    .slice(0, 3)
    .map((entry) => entry.abbr);
};

const buildReason = (contributions: ScoreContribution[]) => {
  const primary = contributions
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score)[0];

  return primary ?? null;
};

export const buildTradeBlock = (
  state: SaveState,
  userTeamAbbr?: string | null,
): TradeBlockRow[] => {
  const normalizedUserTeamAbbr = userTeamAbbr?.toUpperCase() ?? state.header.teamAbbr;
  const teamContext = buildTeamContext(state);
  const candidateRows: Array<TradeBlockRow & { normalizedPosition: TradePosition }> = [];

  TEAM_LIST.forEach((team) => {
    if (team.abbr === normalizedUserTeamAbbr) return;

    const context = teamContext.get(team.abbr);
    if (!context) return;

    context.ratedByPosition.forEach((room, position) => {
      const starterCount = getStarterCount(position);

      room.forEach((player, index) => {
        const depthRank = index + 1;
        const candidateContext: CandidateContext = {
          player,
          depthRank,
          starterCount,
          room,
          teamCapSpace: context.capSpace,
        };

        if (isUntouchable(candidateContext)) {
          return;
        }

        const contributions = scoreCandidate(candidateContext);
        const positiveScore = contributions.reduce((sum, entry) => sum + entry.score, 0);
        if (positiveScore < 12) {
          return;
        }

        const rng = createRng(
          `${state.header.id}:${state.header.phase}:${team.abbr}:${player.id}:${position}`,
        );
        const interestingness = positiveScore + player.resolvedRating * 0.18 + rng() * 4;
        if (interestingness < 24) {
          return;
        }

        const bestReason = buildReason(contributions);
        if (!bestReason) {
          return;
        }

        candidateRows.push({
          ...player,
          rating: player.resolvedRating,
          tradeBlockReason: bestReason.reason,
          tradeBlockScore: Number(interestingness.toFixed(1)),
          tradeBlockCategory: bestReason.category,
          potentialFits: buildPotentialFits(
            state,
            player,
            position,
            teamContext,
            normalizedUserTeamAbbr,
          ),
          contractSummary: formatContractSummary(player),
          currentDepthRank: depthRank,
          normalizedPosition: position,
        });
      });
    });
  });

  const byTeam = new Map<string, number>();
  const byPosition = new Map<TradePosition, number>();

  return candidateRows
    .sort((left, right) => {
      if (right.tradeBlockScore !== left.tradeBlockScore) {
        return right.tradeBlockScore - left.tradeBlockScore;
      }
      if ((right.rating ?? 0) !== (left.rating ?? 0)) {
        return (right.rating ?? 0) - (left.rating ?? 0);
      }
      return `${left.firstName} ${left.lastName}`.localeCompare(`${right.firstName} ${right.lastName}`);
    })
    .filter((row) => row.potentialFits.length > 0)
    .filter((row) => {
      const teamCount = byTeam.get(row.teamAbbr ?? '') ?? 0;
      if (teamCount >= MAX_PLAYERS_PER_TEAM) {
        return false;
      }

      const positionCount = byPosition.get(row.normalizedPosition) ?? 0;
      if (positionCount >= MAX_PLAYERS_PER_POSITION[row.normalizedPosition]) {
        return false;
      }

      byTeam.set(row.teamAbbr ?? '', teamCount + 1);
      byPosition.set(row.normalizedPosition, positionCount + 1);
      return true;
    })
    .slice(0, TOTAL_TRADE_BLOCK_SIZE)
    .map(({ normalizedPosition: _normalizedPosition, ...row }) => row);
};
