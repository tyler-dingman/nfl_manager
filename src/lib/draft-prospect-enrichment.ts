import type { UnifiedPlayerStats } from '@/server/data/nfl-data';

export type DraftProspectArchetypeContext = {
  position: string | null;
  stats?: UnifiedPlayerStats;
  height?: string | null;
  weight?: number | null;
};

export type DraftProspectSummaryInput = {
  name: string;
  ranking: number | null;
  school: string | null;
  position: string | null;
  classYear: string | null;
  height: string | null;
  weight: number | null;
  stats: UnifiedPlayerStats;
  archetype: string | null;
};

const premiumPositions = new Set(['QB', 'OT', 'EDGE', 'WR', 'CB']);

export const normalizeDraftPosition = (position: string | null | undefined): string => {
  const normalized = position?.trim().toUpperCase() ?? '';
  if (['LT', 'RT', 'T', 'OT'].includes(normalized)) return 'OT';
  if (['LG', 'RG', 'G', 'OL', 'IOL', 'C'].includes(normalized)) return 'IOL';
  if (['LE', 'RE', 'DE', 'EDGE', 'ED'].includes(normalized)) return 'EDGE';
  if (['DT', 'NT', 'DL', 'IDL'].includes(normalized)) return 'DL';
  if (['OLB', 'ILB', 'MLB', 'LB', 'EDGE/LB'].includes(normalized)) return 'LB';
  if (['FS', 'SS', 'S', 'SAF'].includes(normalized)) return 'S';
  if (['HB', 'FB', 'RB'].includes(normalized)) return 'RB';
  return normalized || 'ATH';
};

export const getProjectedRangeFromRanking = (ranking: number | null): string => {
  if (!ranking) return 'Day 2';
  if (ranking <= 10) return 'Top 10';
  if (ranking <= 32) return 'Round 1';
  if (ranking <= 64) return 'Round 1-2';
  if (ranking <= 100) return 'Day 2';
  if (ranking <= 180) return 'Day 3';
  if (ranking <= 260) return 'Late Round / Priority UDFA';
  return 'Priority UDFA';
};

export const getRankingTier = (ranking: number | null): string => {
  if (!ranking) return 'notable';
  if (ranking <= 10) return 'top-tier';
  if (ranking <= 32) return 'first-round';
  if (ranking <= 64) return 'day-two';
  if (ranking <= 120) return 'mid-round';
  return 'late-round';
};

export const getProductionTier = (stats: UnifiedPlayerStats, position: string | null): string => {
  const normalizedPosition = normalizeDraftPosition(position);
  if (normalizedPosition === 'QB') {
    if ((stats.passingYards ?? 0) >= 3200 || (stats.passingTD ?? 0) >= 28) return 'high';
    if ((stats.passingYards ?? 0) >= 2200 || (stats.passingTD ?? 0) >= 18) return 'solid';
    return 'developing';
  }
  if (normalizedPosition === 'RB') {
    if ((stats.rushYards ?? 0) >= 1100 || (stats.rushTD ?? 0) >= 12) return 'high';
    if ((stats.rushYards ?? 0) >= 650 || (stats.rushTD ?? 0) >= 6) return 'solid';
    return 'developing';
  }
  if (['WR', 'TE'].includes(normalizedPosition)) {
    if ((stats.recYards ?? 0) >= 850 || (stats.recTD ?? 0) >= 8) return 'high';
    if ((stats.recYards ?? 0) >= 450 || (stats.receptions ?? 0) >= 30) return 'solid';
    return 'developing';
  }
  if (['EDGE', 'DL', 'LB'].includes(normalizedPosition)) {
    if ((stats.sacks ?? 0) >= 8 || (stats.tfl ?? 0) >= 12) return 'high';
    if ((stats.sacks ?? 0) >= 4 || (stats.tfl ?? 0) >= 6 || (stats.tackles ?? 0) >= 55)
      return 'solid';
    return 'developing';
  }
  if (['CB', 'S'].includes(normalizedPosition)) {
    if ((stats.interceptionsDef ?? 0) >= 3 || (stats.passDeflections ?? 0) >= 8) return 'high';
    if ((stats.interceptionsDef ?? 0) >= 1 || (stats.passDeflections ?? 0) >= 4) return 'solid';
    return 'developing';
  }
  return 'developing';
};

export const getReadinessTier = ({
  ranking,
  classYear,
  position,
  stats,
}: {
  ranking: number | null;
  classYear: string | null;
  position: string | null;
  stats: UnifiedPlayerStats;
}): string => {
  const productionTier = getProductionTier(stats, position);
  const normalizedPosition = normalizeDraftPosition(position);
  if ((ranking ?? 999) <= 32 && productionTier !== 'developing') return 'early contributor';
  if (['SR', 'RS SR', 'GR', 'GRAD'].includes((classYear ?? '').toUpperCase())) return 'pro ready';
  if (premiumPositions.has(normalizedPosition) && (ranking ?? 999) <= 64) return 'starter upside';
  return 'developmental';
};

export const inferDraftProspectArchetype = ({
  position,
  stats = {},
  weight,
}: DraftProspectArchetypeContext): string => {
  const normalizedPosition = normalizeDraftPosition(position);
  if (normalizedPosition === 'QB') {
    if ((stats.rushYards ?? 0) >= 350) return 'Dual-Threat QB';
    return 'Pocket QB';
  }
  if (normalizedPosition === 'RB') {
    if ((stats.receptions ?? 0) >= 25) return 'All-Purpose RB';
    return 'Power RB';
  }
  if (normalizedPosition === 'WR') {
    if ((stats.yardsPerCatch ?? 0) >= 15) return 'Deep Threat WR';
    if ((stats.receptions ?? 0) >= 70) return 'Possession WR';
    return 'Balanced WR';
  }
  if (normalizedPosition === 'TE') {
    if ((stats.receptions ?? 0) >= 35) return 'Move TE';
    return 'Inline TE';
  }
  if (normalizedPosition === 'EDGE') {
    if ((stats.sacks ?? 0) >= 9) return 'Pass-Rush EDGE';
    return 'Power EDGE';
  }
  if (normalizedPosition === 'LB') {
    if ((stats.passDeflections ?? 0) >= 4 || (stats.interceptionsDef ?? 0) >= 2)
      return 'Coverage LB';
    return 'Run-and-Chase LB';
  }
  if (normalizedPosition === 'CB') return 'Cover CB';
  if (normalizedPosition === 'S') return 'Ballhawk Safety';
  if (normalizedPosition === 'OT') return weight && weight >= 325 ? 'Power Tackle' : 'Pass-Set OT';
  if (normalizedPosition === 'IOL') return 'Anchor IOL';
  if (normalizedPosition === 'DL') return 'Interior Disruptor';
  return 'Developmental Prospect';
};

export const generateDraftProspectSummary = ({
  ranking,
  school,
  position,
  classYear,
  height,
  weight,
  stats,
  archetype,
}: DraftProspectSummaryInput): string => {
  const normalizedPosition = normalizeDraftPosition(position);
  const rankingTier = getRankingTier(ranking);
  const productionTier = getProductionTier(stats, position);
  const readinessTier = getReadinessTier({ ranking, classYear, position, stats });
  const schoolText = school ?? 'the college ranks';
  const sizeText = [height, weight ? `${weight} lbs` : null].filter(Boolean).join(', ');
  const archetypeText = archetype ?? inferDraftProspectArchetype({ position, stats, weight });

  if (rankingTier === 'top-tier') {
    return `A top-tier ${normalizedPosition} prospect out of ${schoolText}, ${archetypeText.toLowerCase()} brings premium draft value${sizeText ? ` with a ${sizeText} frame` : ''}. Projects as an ${readinessTier} with long-term starter upside.`;
  }

  if (productionTier === 'high') {
    return `A productive ${normalizedPosition} from ${schoolText}, this prospect pairs ${archetypeText.toLowerCase()} traits with strong college output${sizeText ? ` at ${sizeText}` : ''}. Looks like an ${readinessTier} who can compete for snaps early.`;
  }

  if (readinessTier === 'developmental') {
    return `A developmental ${normalizedPosition} prospect from ${schoolText}, ${archetypeText.toLowerCase()} offers intriguing traits and room to grow${sizeText ? ` in a ${sizeText} build` : ''}. Best suited as a longer-term investment with upside.`;
  }

  return `A notable ${normalizedPosition} prospect from ${schoolText}, ${archetypeText.toLowerCase()} gives teams a balanced mix of value and fit${sizeText ? ` with a ${sizeText} profile` : ''}. Projects as an ${readinessTier} with rotational-to-starter appeal.`;
};
