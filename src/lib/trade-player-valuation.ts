import { resolvePlayerRating, normalizeOverviewPosition } from '@/lib/team-overview';
import type {
  TradeEvaluationContext,
  TradePlayerAssetDTO,
  TradePlayerInput,
  TradePlayerValueResult,
} from '@/types/trade-offers';

const POSITION_PREMIUM: Record<string, number> = {
  QB: 1.28,
  LT: 1.14,
  RT: 1.08,
  EDGE: 1.14,
  WR: 1.08,
  CB: 1.08,
  C: 1.03,
  LG: 1.01,
  RG: 1.01,
  TE: 0.98,
  DL: 1.02,
  LB: 0.96,
  S: 0.97,
  RB: 0.88,
  K: 0.45,
  P: 0.4,
  OTHER: 0.92,
};

const PRIME_AGE: Record<string, number> = {
  QB: 28,
  RB: 24,
  WR: 26,
  TE: 27,
  LT: 27,
  RT: 27,
  LG: 27,
  RG: 27,
  C: 28,
  EDGE: 26,
  DL: 27,
  LB: 26,
  CB: 25,
  S: 26,
  K: 29,
  P: 29,
  OTHER: 27,
};

const ageBucketForPosition = (position: string) => PRIME_AGE[position] ?? PRIME_AGE.OTHER;

const nonlinearRatingScore = (rating: number) => {
  const centered = Math.max(0, rating - 58);
  return 16 + centered * centered * 0.92;
};

const ageMultiplier = (age: number, position: string) => {
  const prime = ageBucketForPosition(position);
  const delta = age - prime;
  if (delta <= 0) {
    return Number((1 + Math.max(-0.12, delta * 0.015)).toFixed(3));
  }
  return Number(Math.max(0.68, 1 - delta * 0.04).toFixed(3));
};

const getApy = (player: TradePlayerInput) =>
  player.averagePerYear ??
  player.contract?.apy ??
  player.salary ??
  player.capHitValue ??
  (Number(player.capHit.replace(/[^0-9.]/g, '')) || 0);

const contractMultiplier = (player: TradePlayerInput, position: string) => {
  const apy = getApy(player);
  const yearsRemaining = Math.max(
    1,
    player.contract?.yearsRemaining ?? player.contractYearsRemaining ?? 1,
  );
  const rating = resolvePlayerRating(player) ?? 70;
  const marketRate = Math.max(2, (rating - 55) * 0.42);
  const overpayRatio = apy / marketRate;
  const costFactor =
    overpayRatio <= 1
      ? 1.03 + (1 - overpayRatio) * 0.07
      : Math.max(0.68, 1 - (overpayRatio - 1) * 0.18);
  const termFactor =
    yearsRemaining === 1
      ? position === 'QB'
        ? 0.96
        : 0.9
      : yearsRemaining <= 3
        ? 1.02
        : Math.max(0.88, 1.02 - (yearsRemaining - 3) * 0.04);
  return Number((costFactor * termFactor).toFixed(3));
};

const potentialMultiplier = (player: TradePlayerInput) => {
  const rating = player.rating ?? 0;
  const madden = player.maddenRating ?? rating;
  const baseline = player.baselineRating ?? rating;
  const best = Math.max(rating, madden, baseline);
  const spread = Math.max(0, best - rating);
  return Number(Math.min(1.18, 1 + spread * 0.01).toFixed(3));
};

const productionMultiplier = (player: TradePlayerInput, position: string) => {
  const stats = player.stats ?? {};
  let signal = 0;
  if (position === 'QB') {
    signal += (stats.passingTD ?? 0) * 0.03;
    signal += (stats.passingYards ?? 0) / 5000;
  } else if (position === 'WR' || position === 'TE' || position === 'RB') {
    signal += (stats.recYards ?? 0) / 2500;
    signal += (stats.rushYards ?? 0) / 2500;
    signal += (stats.recTD ?? 0) * 0.04;
    signal += (stats.rushTD ?? 0) * 0.04;
  } else if (position === 'EDGE' || position === 'DL' || position === 'LB') {
    signal += (stats.sacks ?? 0) * 0.07;
    signal += (stats.tfl ?? 0) * 0.02;
    signal += (stats.qbHits ?? 0) * 0.01;
  } else if (position === 'CB' || position === 'S') {
    signal += (stats.interceptionsDef ?? 0) * 0.09;
    signal += (stats.passDeflections ?? 0) * 0.03;
  }
  return Number(Math.min(1.18, Math.max(0.9, 1 + signal * 0.15)).toFixed(3));
};

const normalizedTradePosition = (position: string) => {
  const bucket = normalizeOverviewPosition(position);
  if (bucket === 'LT' || bucket === 'RT') return bucket;
  return bucket;
};

const needMultiplier = (position: string, context?: TradeEvaluationContext) => {
  if (!context) return 1;
  const idx = context.needs.findIndex(
    (need) =>
      need === position ||
      (need === 'OT' && ['LT', 'RT'].includes(position)) ||
      (need === 'IOL' && ['LG', 'RG', 'C'].includes(position)),
  );
  if (idx === -1) return 1;
  return Number((1.12 - idx * 0.035).toFixed(3));
};

export const getPlayerTradeValue = (
  player: TradePlayerInput,
  context?: TradeEvaluationContext,
): TradePlayerValueResult => {
  const rating = resolvePlayerRating(player) ?? 68;
  const position = normalizedTradePosition(player.position);
  const age = player.age ?? ageBucketForPosition(position);
  const ratingScore = nonlinearRatingScore(rating);
  const ageFactor = ageMultiplier(age, position);
  const contractFactor = contractMultiplier(player, position);
  const positionFactor = POSITION_PREMIUM[position] ?? POSITION_PREMIUM.OTHER;
  const potentialFactor = potentialMultiplier(player);
  const productionFactor = productionMultiplier(player, position);
  const needFactor = needMultiplier(position, context);

  const value = Number(
    (
      ratingScore *
      ageFactor *
      contractFactor *
      positionFactor *
      potentialFactor *
      productionFactor *
      needFactor
    ).toFixed(1),
  );

  return {
    value,
    debug: {
      ratingScore: Number(ratingScore.toFixed(1)),
      ageMultiplier: ageFactor,
      contractMultiplier: contractFactor,
      positionMultiplier: positionFactor,
      potentialMultiplier: potentialFactor,
      productionMultiplier: productionFactor,
      needMultiplier: needFactor,
      finalValue: value,
    },
  };
};

export const buildTradePlayerAsset = (
  player: TradePlayerInput,
  context?: TradeEvaluationContext,
): TradePlayerAssetDTO => {
  const rating = resolvePlayerRating(player);
  const value = getPlayerTradeValue(player, context);
  const years = Math.max(1, player.contract?.yearsRemaining ?? player.contractYearsRemaining ?? 1);
  const apy = getApy(player);

  return {
    id: `player-${player.id}`,
    type: 'player',
    playerId: player.id,
    teamAbbr: player.teamAbbr ?? null,
    name: `${player.firstName} ${player.lastName}`,
    position: player.position,
    age: player.age ?? null,
    rating: rating ?? null,
    capHit: player.capHit,
    contractSummary: `${years} yr · $${apy.toFixed(1)}M`,
    headshotUrl: player.headshotUrl ?? null,
    projectedValuePoints: value.value,
  };
};
