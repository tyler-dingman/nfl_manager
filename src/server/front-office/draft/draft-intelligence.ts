import { analyzeTeamNeeds, normalizeOverviewPosition } from '@/lib/team-overview';
import { getTradableDraftPicksForTeam, type SaveState } from '@/server/api/store';
import type { DraftProspectRecord } from '@/server/data/draft-prospects';
import type { FranchiseSimulationState } from '@/types/front-office';

export type RankedProspect = DraftProspectRecord & {
  currentRank: number;
  priorRank: number;
  rankingTrend: number;
  momentumScore: number;
  draftStockScore: number;
  scoutGrade: number;
  projectedPickLow: number;
  projectedPickHigh: number;
  scoutingConfidence: number;
};

const hash = (value: string) => {
  let result = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index);
    result = Math.imul(result, 16777619);
  }
  return result >>> 0;
};
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const gradeFor = (prospect: DraftProspectRecord) => {
  const parsed = Number.parseFloat(prospect.grade ?? '');
  return Number.isFinite(parsed)
    ? clamp(parsed, 55, 99)
    : clamp(96 - ((prospect.ranking ?? 150) - 1) * 0.27, 60, 96);
};
const toNeedPosition = (position: string) => {
  const raw = position.trim().toUpperCase();
  if (['OT', 'T', 'LT', 'RT'].includes(raw)) return 'OT';
  if (['IOL', 'G', 'LG', 'RG', 'C'].includes(raw)) return 'IOL';
  const normalized = normalizeOverviewPosition(raw);
  return normalized === 'LT' || normalized === 'RT'
    ? 'OT'
    : normalized === 'LG' || normalized === 'RG' || normalized === 'C'
      ? 'IOL'
      : normalized;
};

export function buildWeeklyProspectRankings(input: {
  prospects: DraftProspectRecord[];
  seed: string;
  week: number;
}): RankedProspect[] {
  const evaluated = input.prospects.map((prospect) => {
    const baseRank = prospect.ranking ?? 999;
    const weeklySignal = (hash(`${input.seed}:${prospect.id}:${input.week}:event`) % 61) - 30;
    const profileSignal = (hash(`${prospect.id}:profile`) % 31) - 15;
    const momentumScore = clamp(Math.round(weeklySignal * 1.35 + profileSignal * 0.45), -100, 100);
    const scoutGrade = gradeFor(prospect);
    const positionValue = ['QB', 'EDGE', 'OT', 'CB', 'WR'].includes(prospect.position ?? '')
      ? 3
      : 0;
    const draftStockScore = clamp(scoutGrade + momentumScore * 0.08 + positionValue, 0, 100);
    return { prospect, baseRank, momentumScore, scoutGrade, draftStockScore };
  });
  const ordered = [...evaluated].sort(
    (a, b) => b.draftStockScore - a.draftStockScore || a.baseRank - b.baseRank,
  );
  return ordered.map((entry, index) => {
    const currentRank = index + 1;
    const trend = entry.baseRank - currentRank;
    return {
      ...entry.prospect,
      currentRank,
      priorRank: entry.baseRank,
      rankingTrend: trend,
      momentumScore: entry.momentumScore,
      draftStockScore: Number(entry.draftStockScore.toFixed(1)),
      scoutGrade: Math.round(entry.scoutGrade),
      projectedPickLow: Math.max(1, currentRank - Math.max(2, Math.round(8 - input.week / 3))),
      projectedPickHigh: currentRank + Math.max(3, Math.round(10 - input.week / 3)),
      scoutingConfidence: clamp(
        48 + input.week * 2 + (hash(`${entry.prospect.id}:confidence`) % 12),
        48,
        96,
      ),
    };
  });
}

export function buildDraftCentralIntelligence(input: {
  state: SaveState;
  simulation: FranchiseSimulationState | null;
  prospects: DraftProspectRecord[];
  teamAbbr: string;
}) {
  const week = Math.max(1, input.simulation?.currentWeek ?? 1);
  const season = input.simulation?.season ?? input.state.header.year;
  const draftYear = season + 1;
  const seed = input.simulation?.seed ?? `${input.state.header.id}:${draftYear}`;
  const prospects = buildWeeklyProspectRankings({ prospects: input.prospects, seed, week });
  const needAnalysis = analyzeTeamNeeds(input.state.roster);
  const needs = needAnalysis.slice(0, 6).map((need) => need.position);
  const draftOrder = input.simulation?.draftOrder ?? [];
  const projectedSlot = Math.max(1, draftOrder.indexOf(input.teamAbbr) + 1 || 16);
  const picks = getTradableDraftPicksForTeam(input.state, input.teamAbbr).map((pick) => ({
    ...pick,
    displayOverall: pick.overallSlot ?? (pick.round - 1) * 32 + projectedSlot,
  }));
  const liveDraft =
    input.simulation?.completedDraft ??
    Object.values(input.state.draftSessions).find(
      (session) => session.mode === 'real' && session.draftYear === draftYear,
    );
  const selectedIds = new Set(
    liveDraft?.picks.flatMap((pick) => (pick.selectedPlayerId ? [pick.selectedPlayerId] : [])) ??
      [],
  );
  const availableProspects = prospects.filter((prospect) => !selectedIds.has(prospect.id));
  const remainingPicks = liveDraft
    ? liveDraft.picks
        .filter(
          (pick) =>
            pick.ownerTeamAbbr === input.teamAbbr &&
            !pick.selectedPlayerId &&
            pick.round <= liveDraft.maxRounds,
        )
        .map((pick) => ({
          id: pick.id,
          year: draftYear,
          round: pick.round,
          displayOverall: pick.overall,
        }))
    : picks.filter((pick) => pick.year === draftYear);
  const fits = prospects
    .map((prospect) => {
      const position = toNeedPosition(prospect.position ?? '');
      const needIndex = needs.indexOf(position as (typeof needs)[number]);
      const needFitScore = needIndex < 0 ? 28 : 95 - needIndex * 9;
      const availabilityDistance = Math.min(Math.abs(prospect.currentRank - projectedSlot), 35);
      const availabilityScore = clamp(100 - availabilityDistance * 3, 10, 100);
      const overallFitScore =
        needFitScore * 0.4 + prospect.scoutGrade * 0.35 + availabilityScore * 0.25;
      return { ...prospect, needFitScore, availabilityScore, overallFitScore };
    })
    .sort((a, b) => b.overallFitScore - a.overallFitScore);
  const news = prospects
    .filter((prospect) => Math.abs(prospect.rankingTrend) >= 2)
    .slice(0, 8)
    .map((prospect, index) => {
      const rising = prospect.rankingTrend > 0;
      return {
        id: `draft-${season}-${week}-${prospect.id}-${rising ? 'rise' : 'fall'}`,
        prospectId: prospect.id,
        category: rising ? (index === 0 ? 'Rising Prospect' : 'Trending') : 'Draft Stock',
        headline: rising
          ? `${prospect.name} is climbing draft boards`
          : `${prospect.name} faces new draft questions`,
        summary: rising
          ? `${prospect.position ?? 'Prospect'} ${prospect.name} has gained momentum and moved ${Math.abs(prospect.rankingTrend)} spots in the current projection.`
          : `${prospect.name} has slipped ${Math.abs(prospect.rankingTrend)} spots as the scouting picture develops.`,
      };
    });
  const recommendations = needAnalysis.slice(0, 5).map((need, index) => {
    const positionProspects = prospects.filter(
      (prospect) => toNeedPosition(prospect.position ?? '') === need.position,
    );
    const nearestProspect = positionProspects.sort(
      (left, right) =>
        Math.abs(left.currentRank - projectedSlot) - Math.abs(right.currentRank - projectedSlot),
    )[0];
    const weakDepth = need.keyDepth < Math.max(1, need.requiredStarters - 1);
    const round = nearestProspect
      ? Math.max(1, Math.min(7, Math.ceil(nearestProspect.currentRank / 32)))
      : 1;
    const title =
      need.level === 'High' && index === 0
        ? `Address ${need.position} Early`
        : weakDepth
          ? `Add ${need.position} Depth`
          : need.level === 'Low'
            ? `Monitor ${need.position} Value`
            : `Look for ${need.position} Value in Round ${round}`;
    const detail = weakDepth
      ? `The current ${need.position} group needs more playable depth behind its projected starters.`
      : nearestProspect
        ? `${nearestProspect.name} is the nearest-ranked ${need.position} prospect to your projected selection range.`
        : `${need.position} remains a roster priority based on current quality and contract outlook.`;
    return { position: need.position, title, detail, round };
  });
  return {
    week,
    season,
    draftYear,
    projectedSlot,
    needs,
    needAnalysis,
    recommendations,
    picks,
    remainingPicks,
    availableProspects,
    prospects,
    fits,
    news,
  };
}
