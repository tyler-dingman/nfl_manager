import { createRng } from '@/lib/deterministic-rng';
import type { IngestedContract, IngestedLeagueData, IngestedPlayer } from '@/server/data/nfl-data';
import type { FreeAgentSeed } from '@/server/data/free-agents';
import type { PlayerRowDTO } from '@/types/player';

export type MarketTier = 'elite' | 'starter' | 'bridge' | 'depth' | 'camp';
export type RoleTier = 'starter' | 'depth' | 'developmental';

export type FreeAgentProfile = {
  source: 'real' | 'seed' | 'released';
  marketStatus: 'unsigned' | 'available' | 'signed' | 'removed';
  marketTier: MarketTier;
  roleTier: RoleTier;
  expectedAnnualValue: number;
  expectedContractYears: number;
  guaranteeExpectationPct: number;
  guaranteedMoneyDemand: number;
  ageCurveFactor: number;
  declineRisk: number;
  demandScore: number;
  signingDifficulty: number;
  competitionScore: number;
  signingInterestScore: number;
  teamFitScore: number;
  bestFitTeamAbbr?: string;
  schemeFitTags: string[];
  available: boolean;
  generatedAt: string;
  refreshedAt: string;
};

export type FreeAgencySeedRecord = {
  id: string;
  firstName: string;
  lastName: string;
  position: string;
  age?: number;
  yearsPro?: number;
  previousApy?: number;
  marketValue?: number;
  source: 'real' | 'seed';
};

const bucketPosition = (position: string): string => {
  const normalized = position.toUpperCase();
  if (['LT', 'RT', 'LG', 'RG', 'C', 'G', 'OT', 'IOL'].includes(normalized)) return 'OL';
  if (['EDGE', 'ED'].includes(normalized)) return 'EDGE';
  if (['DE', 'DT', 'NT', 'IDL', 'DL'].includes(normalized)) return 'DL';
  if (['FS', 'SS'].includes(normalized)) return 'S';
  if (['K', 'P', 'LS'].includes(normalized)) return 'ST';
  return normalized;
};

const splitName = (name: string) => {
  const parts = name.trim().split(/\s+/);
  if (parts.length < 2) return { firstName: name.trim(), lastName: '' };
  return { firstName: parts[0] ?? '', lastName: parts.slice(1).join(' ') };
};

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const buildEligibilityFromContracts = (league: IngestedLeagueData): FreeAgencySeedRecord[] => {
  if (league.players.length === 0) return [];
  const contractByPlayerId = new Map<string, IngestedContract[]>();
  for (const contract of league.contracts) {
    const bucket = contractByPlayerId.get(contract.playerId) ?? [];
    bucket.push(contract);
    contractByPlayerId.set(contract.playerId, bucket);
  }

  const isLikelyUnsigned = (player: IngestedPlayer): boolean => {
    const contracts = contractByPlayerId.get(player.id) ?? [];
    if (contracts.length === 0) return true;
    return contracts.some((contract) => {
      const status = (contract.contractStatus ?? '').toLowerCase();
      return status.includes('free') || status.includes('unsigned') || status.includes('released');
    });
  };

  return league.players
    .filter(isLikelyUnsigned)
    .map((player) => {
      const fallback = contractByPlayerId.get(player.id)?.[0];
      const { firstName, lastName } = splitName(player.fullName);
      return {
        id: `${player.teamAbbr.toLowerCase()}-${player.id}`,
        firstName,
        lastName,
        position: bucketPosition(player.position),
        previousApy: fallback?.averagePerYear ?? undefined,
        marketValue: fallback?.averagePerYear ?? undefined,
        source: 'real' as const,
      };
    });
};

export const buildGlobalFreeAgencySeed = (
  league: IngestedLeagueData,
  seedPlayers: FreeAgentSeed[],
): FreeAgencySeedRecord[] => {
  const real = buildEligibilityFromContracts(league);
  const seeded: FreeAgencySeedRecord[] = seedPlayers.map((seed, index) => {
    const { firstName, lastName } = splitName(seed.name);
    return {
      id: `seed-${index}-${seed.prevTeam.toLowerCase()}`,
      firstName,
      lastName,
      position: bucketPosition(seed.position),
      age: seed.age,
      yearsPro: seed.yearsPro,
      previousApy: seed.prevAav,
      marketValue: seed.marketValue,
      source: 'seed',
    };
  });

  const merged = new Map<string, FreeAgencySeedRecord>();
  [...real, ...seeded].forEach((player) => {
    const key = `${player.firstName.toLowerCase()}-${player.lastName.toLowerCase()}-${player.position}`;
    if (!merged.has(key)) merged.set(key, player);
  });

  return Array.from(merged.values());
};

const estimatePlayerRating = (record: FreeAgencySeedRecord): number => {
  const base = record.marketValue ? Math.min(95, 60 + record.marketValue / 2_000_000) : 69;
  const age = record.age ?? 28;
  const agePenalty = age > 31 ? (age - 31) * 1.8 : 0;
  const experienceBump = Math.min(6, (record.yearsPro ?? 4) * 0.45);
  return clamp(base + experienceBump - agePenalty, 60, 94);
};

const getTeamNeedScore = (league: IngestedLeagueData, teamAbbr: string, position: string): number => {
  const bucket = bucketPosition(position);
  const countAtPos = league.players.filter(
    (player) => player.teamAbbr === teamAbbr && bucketPosition(player.position) === bucket,
  ).length;
  const idealByPosition: Record<string, number> = {
    QB: 3,
    RB: 4,
    WR: 6,
    TE: 3,
    OL: 9,
    EDGE: 4,
    DL: 6,
    LB: 6,
    CB: 5,
    S: 4,
    ST: 3,
  };
  const ideal = idealByPosition[bucket] ?? 4;
  return clamp((ideal - countAtPos) / ideal, 0, 1);
};

export const buildFreeAgentProfile = ({
  player,
  teamAbbr,
  league,
  generatedAt,
}: {
  player: FreeAgencySeedRecord;
  teamAbbr: string;
  league: IngestedLeagueData;
  generatedAt: string;
}): FreeAgentProfile => {
  const rating = estimatePlayerRating(player);
  const age = player.age ?? 28;
  const ageCurveFactor = clamp(1 - Math.max(0, age - 28) * 0.03, 0.72, 1.08);
  const declineRisk = clamp((age - 29) / 12, 0, 0.92);

  const baseApy = player.marketValue ? player.marketValue / 1_000_000 : rating * 0.18;
  const expectedAnnualValue = Number((baseApy * ageCurveFactor).toFixed(1));
  const expectedContractYears = clamp(Math.round(4 - (age - 27) * 0.15), 1, 4);
  const guaranteeExpectationPct = clamp(0.3 + rating / 200 - declineRisk * 0.2, 0.15, 0.8);
  const guaranteedMoneyDemand = Number(
    (expectedAnnualValue * expectedContractYears * guaranteeExpectationPct).toFixed(1),
  );

  const demandScore = clamp(Math.round((rating - 55) * 1.6 + expectedAnnualValue * 1.8 - declineRisk * 20), 1, 99);
  const teamNeedScore = getTeamNeedScore(league, teamAbbr, player.position);
  const teamFitScore = clamp(
    Math.round(teamNeedScore * 50 + (1 - declineRisk) * 20 + Math.min(30, expectedAnnualValue * 1.5)),
    5,
    99,
  );
  const signingDifficulty = clamp(Math.round((demandScore + expectedAnnualValue * 2) / 2), 10, 99);
  const competitionScore = clamp(Math.round(demandScore * 0.85 + teamNeedScore * 20), 5, 99);

  const marketTier: MarketTier =
    demandScore >= 85 ? 'elite' : demandScore >= 70 ? 'starter' : demandScore >= 55 ? 'bridge' : demandScore >= 40 ? 'depth' : 'camp';
  const roleTier: RoleTier = marketTier === 'elite' || marketTier === 'starter' ? 'starter' : marketTier === 'bridge' ? 'depth' : 'developmental';

  return {
    source: player.source,
    marketStatus: 'available',
    marketTier,
    roleTier,
    expectedAnnualValue,
    expectedContractYears,
    guaranteeExpectationPct: Number((guaranteeExpectationPct * 100).toFixed(1)),
    guaranteedMoneyDemand,
    ageCurveFactor: Number(ageCurveFactor.toFixed(2)),
    declineRisk: Number(declineRisk.toFixed(2)),
    demandScore,
    signingDifficulty,
    competitionScore,
    signingInterestScore: clamp(Math.round(100 - signingDifficulty * 0.55 + teamFitScore * 0.45), 1, 99),
    teamFitScore,
    bestFitTeamAbbr: teamAbbr,
    schemeFitTags: [bucketPosition(player.position), roleTier, age <= 27 ? 'upside' : 'veteran'],
    available: true,
    generatedAt,
    refreshedAt: generatedAt,
  };
};

export const buildFreeAgencyPool = ({
  league,
  teamAbbr,
  seedPlayers,
}: {
  league: IngestedLeagueData;
  teamAbbr: string;
  seedPlayers: FreeAgentSeed[];
}): PlayerRowDTO[] => {
  const generatedAt = new Date().toISOString();
  const rng = createRng(`fa-pool:${teamAbbr}:${league.updatedAt}`);

  return buildGlobalFreeAgencySeed(league, seedPlayers).map((record) => {
    const profile = buildFreeAgentProfile({ player: record, teamAbbr, league, generatedAt });
    const age = record.age ?? Number((24 + rng() * 12).toFixed(1));
    const demandApy = profile.expectedAnnualValue;
    const { source } = profile;

    return {
      id: record.id,
      firstName: record.firstName,
      lastName: record.lastName,
      position: bucketPosition(record.position),
      age,
      marketValue: Math.round(demandApy * 1_000_000),
      contractYearsRemaining: 0,
      capHit: '$0.0M',
      capHitValue: 0,
      salary: 0,
      guaranteed: 0,
      status: 'Free Agent',
      headshotUrl: null,
      freeAgentProfile: {
        ...profile,
        source,
      },
      contract: {
        yearsRemaining: profile.expectedContractYears,
        apy: profile.expectedAnnualValue,
        guaranteed: profile.guaranteedMoneyDemand,
        capHit: profile.expectedAnnualValue,
        expiresAfterSeason: false,
      },
    };
  });
};

export const summarizeFreeAgencyPool = (pool: PlayerRowDTO[]) => {
  const byPosition: Record<string, number> = {};
  const byTier: Record<string, number> = {};
  let missingDemandValues = 0;
  let invalidTeamStatus = 0;

  pool.forEach((player) => {
    const position = bucketPosition(player.position);
    byPosition[position] = (byPosition[position] ?? 0) + 1;

    const tier = player.freeAgentProfile?.marketTier ?? 'unknown';
    byTier[tier] = (byTier[tier] ?? 0) + 1;

    if (!player.freeAgentProfile || player.freeAgentProfile.expectedAnnualValue <= 0) {
      missingDemandValues += 1;
    }

    if (player.status !== 'Free Agent' && player.status !== 'Signed' && player.status !== 'Cut') {
      invalidTeamStatus += 1;
    }
  });

  return {
    totalFreeAgents: pool.length,
    byPosition,
    byTier,
    missingDemandValues,
    invalidTeamStatus,
  };
};
