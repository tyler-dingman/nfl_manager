import type { IngestedContract, IngestedLeagueData, IngestedPlayer } from '@/server/data/nfl-data';
import type { PlayerRowDTO } from '@/types/player';

export type MarketTier = 'elite' | 'starter' | 'depth' | 'fringe';

export type FreeAgentProfileInput = {
  playerId: string;
  saveId: string;
  position: string;
  age?: number;
  yearsPro?: number;
  lastContractApy?: number | null;
  lastGuaranteed?: number | null;
  teamAbbr: string;
  generatedAt: string;
  source?: 'real' | 'released';
  teamNeedScore?: number;
};

export type FreeAgentSeedRecord = {
  playerId: string;
  firstName: string;
  lastName: string;
  position: string;
  age?: number;
  yearsPro?: number;
  lastContractApy?: number | null;
  lastGuaranteed?: number | null;
  source: 'real' | 'released';
};

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export const bucketPosition = (position: string): string => {
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

const isFreeAgentStatus = (status: string | null | undefined) => {
  const normalized = (status ?? '').toLowerCase();
  return (
    normalized.includes('free') ||
    normalized.includes('unsigned') ||
    normalized.includes('released')
  );
};

const getPositionValue = (position: string): number => {
  const bucket = bucketPosition(position);
  const weights: Record<string, number> = {
    QB: 1,
    EDGE: 0.9,
    WR: 0.84,
    CB: 0.82,
    OL: 0.78,
    DL: 0.74,
    S: 0.7,
    LB: 0.68,
    TE: 0.62,
    RB: 0.5,
    ST: 0.35,
  };
  return weights[bucket] ?? 0.6;
};

const getAgeFactor = (age?: number) => {
  const normalizedAge = age ?? 28;
  if (normalizedAge <= 25) return 1.1;
  if (normalizedAge <= 28) return 1;
  if (normalizedAge <= 31) return 0.92;
  if (normalizedAge <= 34) return 0.82;
  return 0.68;
};

export const scorePlayer = ({
  age,
  position,
  experience,
  lastContractApy,
}: {
  age?: number;
  position: string;
  experience: number;
  lastContractApy?: number | null;
}) => {
  const ageScore = clamp(Math.round(getAgeFactor(age) * 35), 10, 38);
  const positionScore = Math.round(getPositionValue(position) * 28);
  const experienceScore = clamp(Math.round(experience * 1.2), 0, 22);
  const contractScore = clamp(Math.round(((lastContractApy ?? 0) / 1_000_000) * 1.2), 0, 30);
  const demandScore = clamp(ageScore + positionScore + experienceScore + contractScore, 10, 99);

  const marketTier: MarketTier =
    demandScore >= 82
      ? 'elite'
      : demandScore >= 62
        ? 'starter'
        : demandScore >= 42
          ? 'depth'
          : 'fringe';

  return { demandScore, marketTier };
};

export const generateContractDemand = ({
  position,
  age,
  lastContractApy,
  lastGuaranteed,
  demandScore,
}: {
  position: string;
  age?: number;
  lastContractApy?: number | null;
  lastGuaranteed?: number | null;
  demandScore: number;
}) => {
  const positionMultiplier = 0.45 + getPositionValue(position);
  const scoreMultiplier = 0.6 + demandScore / 100;
  const ageFactor = getAgeFactor(age);
  const fallbackApy = 1_800_000 * positionMultiplier * scoreMultiplier * ageFactor;
  const apy = Math.max(
    lastContractApy ? lastContractApy * (0.82 + demandScore / 220) : fallbackApy,
    1_000_000,
  );
  const years = clamp(Math.round(1 + demandScore / 24 - Math.max(0, (age ?? 28) - 30) / 5), 1, 5);
  const guaranteePct = clamp(
    (lastGuaranteed && lastContractApy
      ? lastGuaranteed / Math.max(lastContractApy * Math.max(1, years), 1)
      : 0.32) +
      demandScore / 250,
    0.25,
    0.85,
  );

  const totalValue = apy * years;
  const expectedGuarantee = totalValue * guaranteePct;

  return {
    expectedYears: years,
    expectedAPY: Number((apy / 1_000_000).toFixed(1)),
    expectedGuarantee: Number((expectedGuarantee / 1_000_000).toFixed(1)),
    guaranteePct: Number((guaranteePct * 100).toFixed(1)),
    totalValue: Number((totalValue / 1_000_000).toFixed(1)),
  };
};

const contractByPlayerId = (contracts: IngestedContract[]) => {
  const map = new Map<string, IngestedContract[]>();
  contracts.forEach((contract) => {
    const bucket = map.get(contract.playerId) ?? [];
    bucket.push(contract);
    map.set(contract.playerId, bucket);
  });
  return map;
};

export const identifyLeagueFreeAgents = (league: IngestedLeagueData): FreeAgentSeedRecord[] => {
  const contracts = contractByPlayerId(league.contracts);
  const validTeams = new Set(league.teams.map((team) => team.abbreviation));

  const fromTeamless = league.players.filter((player) => !validTeams.has(player.teamAbbr));
  const fromContractStatus = league.players.filter((player) =>
    (contracts.get(player.id) ?? []).some((contract) => isFreeAgentStatus(contract.contractStatus)),
  );

  const merged = new Map<string, FreeAgentSeedRecord>();
  [...fromTeamless, ...fromContractStatus].forEach((player: IngestedPlayer) => {
    const { firstName, lastName } = splitName(player.fullName);
    const latestContract = (contracts.get(player.id) ?? [])[0];
    merged.set(player.id, {
      playerId: player.id,
      firstName,
      lastName,
      position: bucketPosition(player.position),
      lastContractApy: latestContract?.averagePerYear,
      lastGuaranteed: latestContract?.guaranteedMoney,
      source: 'real',
    });
  });

  return Array.from(merged.values());
};

const getTeamNeedScore = (
  league: IngestedLeagueData,
  teamAbbr: string,
  position: string,
): number => {
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

export const buildFreeAgentProfile = (input: FreeAgentProfileInput) => {
  const experience = clamp(input.yearsPro ?? 4, 0, 20);
  const scoring = scorePlayer({
    age: input.age,
    position: input.position,
    experience,
    lastContractApy: input.lastContractApy,
  });
  const contractDemand = generateContractDemand({
    position: input.position,
    age: input.age,
    lastContractApy: input.lastContractApy,
    lastGuaranteed: input.lastGuaranteed,
    demandScore: scoring.demandScore,
  });
  const ageFactor = Number(getAgeFactor(input.age).toFixed(2));
  const fitScore = clamp(
    Math.round((input.teamNeedScore ?? 0.5) * 70 + (100 - scoring.demandScore) * 0.3),
    1,
    99,
  );

  return {
    playerId: input.playerId,
    saveId: input.saveId,
    expectedYears: contractDemand.expectedYears,
    expectedAPY: contractDemand.expectedAPY,
    expectedGuarantee: contractDemand.expectedGuarantee,
    marketTier: scoring.marketTier,
    roleTier:
      scoring.marketTier === 'elite' || scoring.marketTier === 'starter' ? 'starter' : 'depth',
    demandScore: scoring.demandScore,
    ageFactor,
    position: bucketPosition(input.position),
    availabilityStatus: 'available' as const,
    lastUpdated: input.generatedAt,
    source: input.source ?? 'real',
    marketStatus: 'available' as const,
    expectedAnnualValue: contractDemand.expectedAPY,
    expectedContractYears: contractDemand.expectedYears,
    guaranteeExpectationPct: contractDemand.guaranteePct,
    guaranteedMoneyDemand: contractDemand.expectedGuarantee,
    ageCurveFactor: ageFactor,
    declineRisk: Number((1 - ageFactor).toFixed(2)),
    signingDifficulty: clamp(Math.round(scoring.demandScore * 0.9), 1, 99),
    competitionScore: clamp(Math.round(scoring.demandScore * 0.85), 1, 99),
    signingInterestScore: clamp(Math.round(100 - scoring.demandScore * 0.6), 1, 99),
    teamFitScore: fitScore,
    bestFitTeamAbbr: input.teamAbbr,
    schemeFitTags: [bucketPosition(input.position)],
    available: true,
    generatedAt: input.generatedAt,
    refreshedAt: input.generatedAt,
  };
};

export const buildFreeAgencyPool = ({
  saveId,
  league,
  teamAbbr,
  releasedPlayers = [],
}: {
  saveId: string;
  league: IngestedLeagueData;
  teamAbbr: string;
  releasedPlayers?: FreeAgentSeedRecord[];
}): PlayerRowDTO[] => {
  const generatedAt = new Date().toISOString();
  const merged = new Map<string, FreeAgentSeedRecord>();

  identifyLeagueFreeAgents(league).forEach((record) => merged.set(record.playerId, record));
  releasedPlayers.forEach((record) =>
    merged.set(record.playerId, { ...record, source: 'released' }),
  );

  return Array.from(merged.values()).map((record) => {
    const profile = buildFreeAgentProfile({
      ...record,
      saveId,
      teamAbbr,
      generatedAt,
      source: record.source,
      teamNeedScore: getTeamNeedScore(league, teamAbbr, record.position),
    });

    return {
      id: record.playerId,
      firstName: record.firstName,
      lastName: record.lastName,
      position: bucketPosition(record.position),
      age: record.age,
      marketValue: Math.round(profile.expectedAPY * 1_000_000),
      contractYearsRemaining: 0,
      capHit: '$0.0M',
      capHitValue: 0,
      salary: 0,
      guaranteed: 0,
      status: 'Free Agent',
      headshotUrl: null,
      freeAgentProfile: profile,
      contract: {
        yearsRemaining: profile.expectedYears,
        apy: profile.expectedAPY,
        guaranteed: profile.expectedGuarantee,
        capHit: profile.expectedAPY,
        expiresAfterSeason: false,
      },
    };
  });
};

export const summarizeFreeAgencyPool = (pool: PlayerRowDTO[]) => {
  const byPosition: Record<string, number> = {};
  const seen = new Set<string>();
  let duplicatePlayers = 0;

  pool.forEach((player) => {
    const position = bucketPosition(player.position);
    byPosition[position] = (byPosition[position] ?? 0) + 1;
    if (seen.has(player.id)) duplicatePlayers += 1;
    seen.add(player.id);
  });

  return {
    totalFreeAgents: pool.length,
    byPosition,
    duplicatePlayers,
    signedPlayersInPool: pool.filter((player) => player.status.toLowerCase() !== 'free agent')
      .length,
  };
};
