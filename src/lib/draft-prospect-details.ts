import type { DraftBoardEntry } from '@/lib/draft-board';
import type { DraftRun } from '@/lib/draft-intelligence';
import { resolvePlayerRating } from '@/lib/team-overview';
import type { PlayerRowDTO } from '@/types/player';

export type ProspectIndicatorTone = 'default' | 'success' | 'warning' | 'danger' | 'accent';

export type ProspectIndicator = {
  key: string;
  label: string;
  tone: ProspectIndicatorTone;
};

export type ProspectDetailsModel = {
  name: string;
  position: string;
  school: string;
  headshotUrl: string | null;
  ratingDisplay: string;
  projectedRange: string;
  indicators: ProspectIndicator[];
  age: number | null;
  height: string | null;
  weight: number | null;
  archetype: string;
  summary: string;
  strengths: string[];
  weaknesses: string[];
  fitScore: number;
  fitLabel: string;
  fitReason: string;
  outlook: string;
};

const premiumPositions = new Set(['QB', 'WR', 'CB', 'EDGE', 'OT']);

const normalizePosition = (position: string) => {
  const normalized = position.toUpperCase();
  if (['LT', 'RT', 'OT'].includes(normalized)) return 'OT';
  if (['LG', 'RG', 'C', 'IOL', 'OL'].includes(normalized)) return 'IOL';
  if (['EDGE', 'ED', 'DE', 'LE', 'RE'].includes(normalized)) return 'EDGE';
  if (['DT', 'DL', 'NT', 'IDL'].includes(normalized)) return 'DL';
  if (['OLB', 'ILB', 'MLB', 'LB', 'EDGE/LB'].includes(normalized)) return 'LB';
  if (['FS', 'SS', 'S'].includes(normalized)) return 'S';
  return normalized;
};

const getProjectedRange = (player: PlayerRowDTO) => {
  const projected = player.projectedPick ?? player.rank ?? null;
  if (!projected) return 'Day 2 projection';
  if (projected <= 5) return 'Top 5 projection';
  if (projected <= 10) return 'Top 10 projection';
  if (projected <= 20) return 'Round 1 projection';
  if (projected <= 40) return 'Top 40 projection';
  if (projected <= 75) return 'Day 2 projection';
  return 'Mid-round projection';
};

const getArchetype = (player: PlayerRowDTO) => {
  const position = normalizePosition(player.position);
  const rating = resolvePlayerRating(player) ?? 74;
  if (position === 'QB') return rating >= 80 ? 'Franchise-caliber passer' : 'Toolsy pocket passer';
  if (position === 'WR') return rating >= 80 ? 'Explosive playmaker' : 'Vertical separator';
  if (position === 'EDGE') return rating >= 80 ? 'Pressure creator' : 'Developmental rusher';
  if (position === 'CB') return rating >= 80 ? 'Coverage starter' : 'Traits-based cover corner';
  if (position === 'OT') return rating >= 80 ? 'Plug-and-play tackle' : 'Developmental blocker';
  if (position === 'DL') return rating >= 80 ? 'Power disruptor' : 'Rotational front piece';
  if (position === 'LB') return rating >= 80 ? 'Three-down linebacker' : 'Run-and-chase defender';
  return rating >= 80 ? 'Immediate contributor' : 'Developmental upside bet';
};

const baseStrengthsByPosition: Record<string, string[]> = {
  QB: ['Poised decision-maker', 'Creates explosive-play upside', 'Comfortable leading a room'],
  RB: ['Good burst through first contact', 'Presses creases with urgency', 'Useful in space'],
  WR: ['Creates separation at multiple levels', 'Threatens after the catch', 'Expands the offense vertically'],
  TE: ['Reliable size target', 'Can help in multiple personnel groupings', 'Adds red-zone utility'],
  OT: ['Length for NFL edges', 'Stabilizes the pocket', 'Anchor shows starter traits'],
  IOL: ['Strong hands in tight quarters', 'Helps firm up the interior', 'Plays with balance and finish'],
  EDGE: ['Wins with burst off the edge', 'Flashes pressure upside', 'Fits a premium pass-rush role'],
  DL: ['Power through contact', 'Can disrupt the middle', 'Adds depth to the front'],
  LB: ['Range to flow sideline to sideline', 'Fits modern sub-package football', 'Active downhill demeanor'],
  CB: ['Mirror skills in coverage', 'Helps against explosive receivers', 'Can match outside speed'],
  S: ['Versatile secondary piece', 'Good downhill trigger', 'Helps clean up over the top'],
};

const baseWeaknessesByPosition: Record<string, string[]> = {
  QB: ['Will need faster answers against NFL pressure', 'Consistency can still come and go'],
  RB: ['Long-term value at the position is tougher to bank on', 'Pass-pro detail still needs polish'],
  WR: ['Physical corners will test him early', 'Route pacing still has room to sharpen'],
  TE: ['Blocking consistency is still developing', 'Volume role may take time'],
  OT: ['Technique polish is still coming together', 'Hand timing can drift under speed-to-power'],
  IOL: ['May need time before handling top interior power', 'Positional ceiling is more steady than flashy'],
  EDGE: ['Rush plan needs more counters', 'Run-game discipline still fluctuates'],
  DL: ['Pad level can run high', 'Pass-rush finish is still developing'],
  LB: ['Coverage instincts need continued refinement', 'Can get caught peeking in traffic'],
  CB: ['Ball production may lag at first', 'Play strength can still improve'],
  S: ['Can be stressed by layered route combinations', 'Tackling consistency must hold up'],
};

const getFitReason = (player: PlayerRowDTO, teamNeeds: string[], boardEntry?: DraftBoardEntry | null) => {
  const normalizedPosition = normalizePosition(player.position);
  const needIndex = teamNeeds.findIndex((need) => normalizePosition(need) === normalizedPosition);
  if (needIndex === 0) return `Direct hit for your top need at ${player.position}.`;
  if (needIndex !== -1) return `Helps stabilize a current need without reaching.`;
  if ((boardEntry?.valueDelta ?? 0) >= 8) return 'The value is strong enough to justify building ahead.';
  return 'More of a board-value play than a direct need swing.';
};

const getFitScore = (player: PlayerRowDTO, teamNeeds: string[], boardEntry?: DraftBoardEntry | null) => {
  const normalizedPosition = normalizePosition(player.position);
  const needIndex = teamNeeds.findIndex((need) => normalizePosition(need) === normalizedPosition);
  const valueBoost = Math.max(0, boardEntry?.valueDelta ?? 0);
  const premiumBoost = premiumPositions.has(normalizedPosition) ? 8 : 0;
  const needBoost = needIndex === 0 ? 28 : needIndex === 1 ? 20 : needIndex === 2 ? 12 : 0;
  return Math.max(42, Math.min(95, 48 + needBoost + Math.min(16, valueBoost) + premiumBoost));
};

const getFitLabel = (fitScore: number) => {
  if (fitScore >= 86) return 'Elite fit';
  if (fitScore >= 75) return 'Strong fit';
  if (fitScore >= 62) return 'Solid fit';
  return 'Board-value fit';
};

const getSummary = (
  player: PlayerRowDTO,
  boardEntry: DraftBoardEntry | null | undefined,
  teamNeeds: string[],
) => {
  const rating = resolvePlayerRating(player) ?? 74;
  const normalizedPosition = normalizePosition(player.position);
  const needIndex = teamNeeds.findIndex((need) => normalizePosition(need) === normalizedPosition);
  const valueDelta = boardEntry?.valueDelta ?? 0;

  if (needIndex === 0 && valueDelta >= 5) {
    return `${player.firstName} ${player.lastName} checks the rare box of immediate need and strong value. This is the kind of round-one fit that can upgrade the roster now without sacrificing long-term flexibility.`;
  }
  if (premiumPositions.has(normalizedPosition) && rating >= 80) {
    return `${player.firstName} ${player.lastName} profiles as a premium-position swing with real starter potential. The traits are good enough to justify strong interest if you want impact and upside in the same pick.`;
  }
  if (valueDelta >= 8) {
    return `${player.firstName} ${player.lastName} is still sitting on the board later than expected, which makes the value hard to ignore. Even if the fit is not perfect, the draft room should be talking seriously about the upside of this slot.`;
  }
  return `${player.firstName} ${player.lastName} brings a balanced profile for this stage of the draft. The fit is more about roster construction and long-term depth than a headline-grabbing swing, but there is real starter appeal here.`;
};

const getOutlook = (player: PlayerRowDTO, boardEntry: DraftBoardEntry | null | undefined) => {
  const rating = resolvePlayerRating(player) ?? 74;
  const valueDelta = boardEntry?.valueDelta ?? 0;
  if (rating >= 82) return 'Projects as an immediate contributor with starter-level upside.';
  if (valueDelta >= 8) return 'Could become one of the better value picks in this class if the board keeps falling his way.';
  if (premiumPositions.has(normalizePosition(player.position))) {
    return 'Developmental piece now, with the kind of position value that can pay off quickly.';
  }
  return 'Profiles as a rotational contributor early with room to grow into a bigger role.';
};

export const buildProspectIndicators = ({
  player,
  boardEntry,
  teamNeeds,
  activeRuns = [],
}: {
  player: PlayerRowDTO;
  boardEntry?: DraftBoardEntry | null;
  teamNeeds: string[];
  activeRuns?: DraftRun[];
}): ProspectIndicator[] => {
  const indicators: ProspectIndicator[] = [];
  const normalizedPosition = normalizePosition(player.position);
  const fitScore = getFitScore(player, teamNeeds, boardEntry);

  if (boardEntry?.tags.includes('Best Available')) {
    indicators.push({ key: 'best-available', label: 'Best Available', tone: 'accent' });
  }
  if (fitScore >= 75) {
    indicators.push({ key: 'team-fit', label: 'Team Fit', tone: 'success' });
  }
  if (boardEntry?.tags.includes('Steal')) {
    indicators.push({ key: 'steal', label: 'Steal', tone: 'success' });
  } else if (boardEntry?.tags.includes('Sleeper')) {
    indicators.push({ key: 'sleeper', label: 'Sleeper', tone: 'warning' });
  }
  if (premiumPositions.has(normalizedPosition) && (resolvePlayerRating(player) ?? 0) >= 79) {
    indicators.push({ key: 'pro-ready', label: 'Pro Ready', tone: 'default' });
  } else if ((resolvePlayerRating(player) ?? 0) <= 76) {
    indicators.push({ key: 'needs-dev', label: 'Needs Development', tone: 'default' });
  }
  if (activeRuns.some((run) => normalizePosition(run.position) === normalizedPosition)) {
    indicators.push({ key: 'run-risk', label: 'Run Risk', tone: 'danger' });
  }

  return indicators.slice(0, 3);
};

export const buildProspectDetailsModel = ({
  player,
  boardEntry,
  teamNeeds,
  activeRuns = [],
}: {
  player: PlayerRowDTO;
  boardEntry?: DraftBoardEntry | null;
  teamNeeds: string[];
  activeRuns?: DraftRun[];
}): ProspectDetailsModel => {
  const position = normalizePosition(player.position);
  const rating = resolvePlayerRating(player);
  const fitScore = getFitScore(player, teamNeeds, boardEntry);
  const indicators = buildProspectIndicators({ player, boardEntry, teamNeeds, activeRuns });

  return {
    name: `${player.firstName} ${player.lastName}`.trim(),
    position: player.position,
    school: player.college ?? 'School TBD',
    headshotUrl: player.headshotUrl ?? null,
    ratingDisplay: rating ? String(rating) : 'N/A',
    projectedRange: getProjectedRange(player),
    indicators,
    age: player.age ?? null,
    height: player.height ?? null,
    weight: player.weight ?? null,
    archetype: getArchetype(player),
    summary: getSummary(player, boardEntry, teamNeeds),
    strengths: (baseStrengthsByPosition[position] ?? ['High-end competitive profile', 'Scheme versatility', 'Starter upside']).slice(0, 3),
    weaknesses: (baseWeaknessesByPosition[position] ?? ['Projection carries some volatility', 'Will need development time']).slice(0, 2),
    fitScore,
    fitLabel: getFitLabel(fitScore),
    fitReason: getFitReason(player, teamNeeds, boardEntry),
    outlook: getOutlook(player, boardEntry),
  };
};
