import { computeFranchiseTrajectory } from '@/lib/franchise-trajectory';
import { getPlayerTypeIndicator } from '@/lib/player-type-indicator';
import { resolvePlayerRating } from '@/lib/team-overview';
import { CURRENT_MODELED_LEAGUE_YEAR } from '@/server/logic/contract-expiration';
import type { UnifiedPlayerStats } from '@/server/data/nfl-data';
import type { Team as StoreTeam } from '@/features/team/team-store';
import type { PlayerRowDTO } from '@/types/player';
import type { TradeBlockRow } from '@/types/trade-block';
import type { TeamDTO } from '@/types/team';
import type { ExpiringContractRow } from '@/lib/expiring-contracts';

type PlayerDetailsSourceKind = 'roster' | 'freeAgent' | 'expiring' | 'tradeBlock' | 'tradeAsset';

export type PlayerDetailsSource =
  | {
      kind: Exclude<PlayerDetailsSourceKind, 'expiring'>;
      player: PlayerRowDTO | TradeBlockRow;
    }
  | {
      kind: 'expiring';
      player: ExpiringContractRow;
    };

type MeterTier = 'Low' | 'Medium' | 'High';

export type PlayerDetailsModel = {
  id: string;
  name: string;
  position: string;
  age: number | null;
  height: string | null;
  weight: number | null;
  headshotUrl: string | null;
  teamName: string | null;
  teamAbbr: string | null;
  teamLogoUrl: string | null;
  rating: number | null;
  ratingDisplay: string;
  playerTypeLabel: string | null;
  playerTypeIndicator: ReturnType<typeof getPlayerTypeIndicator>;
  contractStatusLine: string;
  bestRole: string | null;
  summary: string;
  outlook: string;
  contractValueTag: string | null;
  contract: Array<{ label: string; value: string }>;
  meters: Array<{
    key: 'loyalty' | 'happiness' | 'motivation' | 'role';
    label: string;
    tier: MeterTier;
    value: number;
    helper: string;
  }>;
  stats: Array<{ label: string; value: string }>;
  tags: string[];
};

type TeamLike = TeamDTO | StoreTeam;

type BuildPlayerDetailsOptions = {
  source: PlayerDetailsSource;
  roster: PlayerRowDTO[];
  teams: TeamLike[];
  userTeamAbbr?: string | null;
  capSpace: number;
  capLimit: number;
};

const OFFENSIVE_POSITIONS = new Set([
  'QB',
  'RB',
  'FB',
  'WR',
  'TE',
  'LT',
  'LG',
  'C',
  'RG',
  'RT',
  'OL',
]);

const DEFENSIVE_BACK_POSITIONS = new Set(['CB', 'S', 'FS', 'SS', 'DB']);
const LINEBACKER_POSITIONS = new Set(['LB', 'MLB', 'OLB']);
const DEFENSIVE_LINE_POSITIONS = new Set(['EDGE', 'ED', 'DE', 'DT', 'DL']);
const OFFENSIVE_LINE_POSITIONS = new Set(['LT', 'LG', 'C', 'RG', 'RT', 'OL']);
const PREMIUM_POSITIONS = new Set(['QB', 'WR', 'LT', 'RT', 'EDGE', 'ED', 'CB']);

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const toTier = (value: number): MeterTier => {
  if (value >= 72) return 'High';
  if (value >= 40) return 'Medium';
  return 'Low';
};

const formatMoneyMillions = (value: number | null | undefined) =>
  value === null || value === undefined || !Number.isFinite(value) ? '—' : `$${value.toFixed(1)}M`;

const formatContractYears = (years: number | null | undefined) =>
  years === null || years === undefined || years <= 0
    ? '—'
    : `${years} yr${years === 1 ? '' : 's'}`;

const inferTeamAbbr = (source: PlayerDetailsSource, userTeamAbbr?: string | null) => {
  if (source.kind === 'expiring') {
    return (
      source.player.teamAbbr ??
      source.player.lastTeamAbbr ??
      source.player.previousTeamAbbr ??
      userTeamAbbr ??
      null
    );
  }
  const player = source.player;
  return (
    player.teamAbbr ??
    player.currentTeamAbbr ??
    player.signedTeamAbbr ??
    player.lastTeamAbbr ??
    userTeamAbbr ??
    null
  );
};

const getTeamLogoUrl = (team: TeamLike | null) => {
  if (!team) return null;
  return 'logoUrl' in team ? team.logoUrl : team.logo_url;
};

const getSourceRating = (source: PlayerDetailsSource) => {
  if (source.kind === 'expiring') {
    return source.player.rating ?? null;
  }
  return resolvePlayerRating(source.player);
};

const getSourceStats = (source: PlayerDetailsSource): UnifiedPlayerStats | undefined =>
  source.kind === 'expiring' ? undefined : source.player.stats;

const getSourceAge = (source: PlayerDetailsSource) => source.player.age ?? null;

const getSourceHeadshot = (source: PlayerDetailsSource) => source.player.headshotUrl ?? null;

const getSourceHeight = (source: PlayerDetailsSource) =>
  source.kind === 'expiring' ? null : (source.player.height ?? null);

const getSourceWeight = (source: PlayerDetailsSource) =>
  source.kind === 'expiring' ? null : (source.player.weight ?? null);

const getSourceDisplayName = (source: PlayerDetailsSource) =>
  source.kind === 'expiring'
    ? source.player.name
    : `${source.player.firstName} ${source.player.lastName}`;

const getSourcePosition = (source: PlayerDetailsSource) =>
  source.kind === 'expiring' ? source.player.pos : source.player.position;

const getContractSnapshot = (source: PlayerDetailsSource) => {
  if (source.kind === 'expiring') {
    return {
      yearsRemaining: 0,
      capHitValue: source.player.currentSalary / 1_000_000,
      capHitLabel: formatMoneyMillions(source.player.currentSalary / 1_000_000),
      apy: source.player.estValue / 1_000_000,
      finalYear: CURRENT_MODELED_LEAGUE_YEAR,
      marketValue: source.player.estValue / 1_000_000,
      status: 'Expiring contract',
    };
  }

  const player = source.player;
  const yearsRemaining = player.contract?.yearsRemaining ?? player.contractYearsRemaining ?? 0;
  const capHitValue = player.contract?.capHit ?? player.capHitValue ?? null;
  const capHitLabel =
    player.capHit && player.capHit !== '$0.0M' ? player.capHit : formatMoneyMillions(capHitValue);
  const apy =
    player.contract?.apy ??
    player.averagePerYear ??
    player.expectedAnnualValue ??
    (typeof player.marketValue === 'number' ? player.marketValue / 1_000_000 : null);
  const finalYear = yearsRemaining > 0 ? CURRENT_MODELED_LEAGUE_YEAR + yearsRemaining - 1 : null;
  const marketValue =
    player.expectedAnnualValue ??
    player.freeAgentProfile?.expectedAnnualValue ??
    (typeof player.marketValue === 'number' ? player.marketValue / 1_000_000 : null);

  let status = 'Not under contract';
  if (player.status.toLowerCase() === 'signed' || player.marketStatus === 'signed') {
    status = 'Recently signed';
  } else if (player.status.toLowerCase() === 'cut') {
    status = 'Released';
  } else if (player.marketStatus === 'unsigned' || player.isUnsigned) {
    status = 'Available in free agency';
  } else if (yearsRemaining > 0) {
    status = `${yearsRemaining} year${yearsRemaining === 1 ? '' : 's'} remaining`;
  }

  return {
    yearsRemaining,
    capHitValue,
    capHitLabel,
    apy,
    finalYear,
    marketValue,
    status,
  };
};

const getPositionRoom = (roster: PlayerRowDTO[], position: string) =>
  roster
    .filter((player) => player.status?.toLowerCase() !== 'cut' && player.position === position)
    .sort((left, right) => (resolvePlayerRating(right) ?? 0) - (resolvePlayerRating(left) ?? 0));

const inferRoleRank = (source: PlayerDetailsSource, roster: PlayerRowDTO[]) => {
  if (source.kind === 'tradeBlock') {
    const tradeBlockPlayer = source.player as TradeBlockRow;
    if (tradeBlockPlayer.currentDepthRank !== null) {
      return tradeBlockPlayer.currentDepthRank;
    }
  }

  if (source.kind === 'expiring') {
    const room = getPositionRoom(roster, source.player.pos);
    const index = room.findIndex((player) => player.id === source.player.id);
    return index === -1 ? null : index + 1;
  }

  const room = getPositionRoom(roster, source.player.position);
  const index = room.findIndex((player) => player.id === source.player.id);
  return index === -1 ? null : index + 1;
};

const bestRoleLabel = (position: string, rank: number | null) => {
  if (!rank) return null;
  if (position === 'QB') return rank === 1 ? 'Franchise QB' : rank === 2 ? 'QB2' : 'Depth QB';
  if (position === 'CB')
    return rank === 1 ? 'CB1' : rank === 2 ? 'CB2' : rank === 3 ? 'Nickel CB' : 'Depth CB';
  if (position === 'WR')
    return rank === 1 ? 'WR1' : rank === 2 ? 'WR2' : rank === 3 ? 'Slot WR' : 'Depth WR';
  if (DEFENSIVE_LINE_POSITIONS.has(position))
    return rank === 1 ? 'Edge Starter' : rank === 2 ? 'Frontline Starter' : 'Rotation Rusher';
  if (OFFENSIVE_LINE_POSITIONS.has(position))
    return rank <= 2 ? 'Starting Tackle' : rank <= 5 ? 'Starting OL' : 'Depth OL';
  return rank === 1 ? 'Starter' : rank <= 3 ? 'Rotation Piece' : 'Depth Piece';
};

const buildLoyaltyScore = (
  source: PlayerDetailsSource,
  teamAbbr: string | null,
  yearsRemaining: number,
) => {
  if (!teamAbbr) return 52;
  if (source.kind === 'expiring') {
    return source.player.lastTeamAbbr === teamAbbr || source.player.teamAbbr === teamAbbr ? 72 : 55;
  }

  const player = source.player;
  if (player.marketStatus === 'unsigned' || player.isUnsigned) return 52;
  const sameTeam =
    player.teamAbbr === teamAbbr ||
    player.currentTeamAbbr === teamAbbr ||
    player.signedTeamAbbr === teamAbbr;
  if (!sameTeam) return 45;
  if (yearsRemaining >= 4) return 82;
  if (yearsRemaining >= 2) return 62;
  return 42;
};

const buildRoleSatisfactionScore = (rating: number | null, roleRank: number | null) => {
  if (!rating) return 55;
  if (!roleRank) return 55;
  if (roleRank === 1) return 82;
  if (roleRank === 2 && rating >= 82) return 48;
  if (roleRank <= 3) return 58;
  return 45;
};

const buildHappinessScore = ({
  source,
  rating,
  roleScore,
  apy,
}: {
  source: PlayerDetailsSource;
  rating: number | null;
  roleScore: number;
  apy: number | null;
}) => {
  if (
    source.kind !== 'expiring' &&
    (source.player.marketStatus === 'unsigned' || source.player.isUnsigned)
  ) {
    return 55;
  }
  if (!rating) return 55;

  const compensationScore = apy ? clamp(55 + (apy - rating / 6) * 6, 30, 88) : 55;
  let score = Math.round(compensationScore * 0.55 + roleScore * 0.45);

  const age = getSourceAge(source);
  if ((age ?? 99) <= 25 && rating >= 84 && !apy) {
    score = Math.min(score, 58);
  }
  if ((age ?? 99) <= 25 && rating >= 84 && apy && apy < rating / 7) {
    score = Math.min(score, 48);
  }

  return clamp(score, 24, 90);
};

const buildMotivationScore = ({
  source,
  trajectoryState,
  yearsRemaining,
}: {
  source: PlayerDetailsSource;
  trajectoryState: string;
  yearsRemaining: number;
}) => {
  const age = getSourceAge(source) ?? 27;
  let score = 58;
  if (yearsRemaining <= 1) score += 18;
  if (age <= 26) score += 14;
  if (trajectoryState === 'Contender' || trajectoryState === 'Rising') score += 8;
  if (age >= 31 && trajectoryState === 'Rebuilding') score -= 10;
  return clamp(score, 30, 88);
};

const buildContractValueTag = ({
  age,
  rating,
  apy,
  yearsRemaining,
}: {
  age: number | null;
  rating: number | null;
  apy: number | null;
  yearsRemaining: number;
}) => {
  if (!rating || apy === null) return null;
  if ((age ?? 99) <= 25 && yearsRemaining >= 2 && apy <= 4 && rating >= 76) return 'Rookie Value';
  if (rating >= 88 && apy <= 10) return 'Steal';
  if (rating >= 82 && apy <= 7) return 'Team Friendly';
  if (apy >= 18 && rating <= 84) return 'Expensive';
  if (Math.abs(apy - rating / 6.6) <= 2.5) return 'Fair Deal';
  if (rating >= 86 && apy <= 12) return 'Team Friendly';
  return 'Fair Deal';
};

const buildStatsSnapshot = (position: string, stats?: UnifiedPlayerStats) => {
  if (!stats) return [];
  const entries: Array<{ label: string; value: string }> = [];

  const push = (label: string, value: number | undefined, formatter?: (raw: number) => string) => {
    if (value === null || value === undefined) return;
    entries.push({ label, value: formatter ? formatter(value) : String(value) });
  };

  if (position === 'QB') {
    push('Pass Yards', stats.passingYards);
    push('Pass TD', stats.passingTD);
    push('INT', stats.interceptions);
    push('Comp %', stats.completionPct, (value) => `${value.toFixed(1)}%`);
    return entries;
  }
  if (position === 'RB' || position === 'FB') {
    push('Rush Yards', stats.rushYards);
    push('Rush TD', stats.rushTD);
    push('YPC', stats.yardsPerCarry, (value) => value.toFixed(1));
    return entries;
  }
  if (position === 'WR' || position === 'TE') {
    push('Receptions', stats.receptions);
    push('Rec Yards', stats.recYards);
    push('Rec TD', stats.recTD);
    push('Y/Catch', stats.yardsPerCatch, (value) => value.toFixed(1));
    return entries;
  }
  if (DEFENSIVE_LINE_POSITIONS.has(position) || LINEBACKER_POSITIONS.has(position)) {
    push('Tackles', stats.tackles);
    push('Sacks', stats.sacks);
    push('TFL', stats.tfl);
    push('QB Hits', stats.qbHits);
    return entries;
  }
  if (DEFENSIVE_BACK_POSITIONS.has(position)) {
    push('INT', stats.interceptionsDef);
    push('Pass Breakups', stats.passDeflections);
    push('Tackles', stats.tackles);
    push('Forced Fumbles', stats.forcedFumbles);
    return entries;
  }

  push('Tackles', stats.tackles);
  push('Sacks', stats.sacks);
  push('Receptions', stats.receptions);
  push('Rush Yards', stats.rushYards);
  return entries.slice(0, 4);
};

const buildTags = ({
  source,
  rating,
  age,
  roleRank,
  yearsRemaining,
  contractValueTag,
  position,
}: {
  source: PlayerDetailsSource;
  rating: number | null;
  age: number | null;
  roleRank: number | null;
  yearsRemaining: number;
  contractValueTag: string | null;
  position: string;
}) => {
  const tags: string[] = [];
  if ((rating ?? 0) >= 90) tags.push('Core Player');
  if (roleRank === 1) tags.push('Starter');
  if (roleRank && roleRank >= 3) tags.push('Depth Piece');
  if ((age ?? 99) <= 25 && (rating ?? 0) >= 82) tags.push('Breakout Candidate');
  if ((age ?? 0) >= 31 && (rating ?? 0) <= 87) tags.push('Regression Risk');
  if ((age ?? 0) >= 30) tags.push('Veteran Presence');
  if ((age ?? 99) <= 26 && (rating ?? 0) >= 76) tags.push('Young Contributor');
  if (yearsRemaining <= 1) tags.push('Contract-Year Motivation');
  if (source.kind === 'tradeBlock') tags.push('Trade Asset');
  if (PREMIUM_POSITIONS.has(position) && (rating ?? 0) >= 82) tags.push('Premium Position');
  if (contractValueTag === 'Rookie Value') tags.push('Rookie Value');
  return [...new Set(tags)].slice(0, 4);
};

export const buildPlayerScoutingTags = ({
  source,
  roster,
}: {
  source: PlayerDetailsSource;
  roster: PlayerRowDTO[];
}) => {
  const position = getSourcePosition(source);
  const rating = getSourceRating(source);
  const age = getSourceAge(source);
  const roleRank = inferRoleRank(source, roster);
  const contract = getContractSnapshot(source);
  const contractValueTag = buildContractValueTag({
    age,
    rating,
    apy: contract.apy,
    yearsRemaining: contract.yearsRemaining,
  });

  return buildTags({
    source,
    rating,
    age,
    roleRank,
    yearsRemaining: contract.yearsRemaining,
    contractValueTag,
    position,
  });
};

const buildOutlook = ({
  age,
  rating,
  trajectoryState,
  yearsRemaining,
}: {
  age: number | null;
  rating: number | null;
  trajectoryState: string;
  yearsRemaining: number;
}) => {
  if ((age ?? 99) <= 25 && (rating ?? 0) >= 82)
    return 'Ascending piece with room to grow inside this roster.';
  if ((age ?? 0) >= 31 && (rating ?? 0) <= 87)
    return 'Likely a win-now contributor with a shorter runway ahead.';
  if (yearsRemaining <= 1)
    return 'A pivotal contract-year player who could shape the next phase of the roster.';
  if (trajectoryState === 'Contender')
    return 'Stable contributor for a team built to push right now.';
  return 'Projects as a steady long-term piece if the role stays consistent.';
};

const buildSummary = ({
  teamName,
  position,
  rating,
  age,
  roleRank,
  contractValueTag,
  source,
  yearsRemaining,
}: {
  teamName: string | null;
  position: string;
  rating: number | null;
  age: number | null;
  roleRank: number | null;
  contractValueTag: string | null;
  source: PlayerDetailsSource;
  yearsRemaining: number;
}) => {
  const teamReference = teamName ?? 'this team';
  const rolePhrase =
    roleRank === 1
      ? 'a clear starter'
      : roleRank && roleRank <= 3
        ? 'part of the weekly rotation'
        : 'more of a depth option';
  const agePhrase =
    (age ?? 99) <= 25 ? 'young ascending' : (age ?? 0) >= 30 ? 'veteran' : 'established';
  const unitPhrase = OFFENSIVE_POSITIONS.has(position) ? 'offense' : 'defense';
  const valuePhrase =
    contractValueTag === 'Steal' ||
    contractValueTag === 'Team Friendly' ||
    contractValueTag === 'Rookie Value'
      ? 'gives the front office useful value flexibility'
      : contractValueTag === 'Expensive'
        ? 'comes with a heavier financial commitment'
        : 'is paid about where you would expect';

  if (source.kind === 'expiring') {
    return `${getSourceDisplayName(source)} heads toward the end of his deal as ${rolePhrase} for ${teamReference}. He remains a ${agePhrase} ${position} whose next contract will say a lot about how this roster is being shaped.`;
  }

  if (
    source.kind === 'freeAgent' ||
    source.player.marketStatus === 'unsigned' ||
    source.player.isUnsigned
  ) {
    return `${getSourceDisplayName(source)} is a ${agePhrase} ${position} option on the open market. With a ${rating ? `${rating} OVR profile` : 'solid profile'}, he could help immediately if ${teamReference} wants to invest at the position.`;
  }

  return `${getSourceDisplayName(source)} is ${rolePhrase} on the ${unitPhrase} for ${teamReference} and profiles as a ${agePhrase} ${position}. His current deal ${valuePhrase}, and ${yearsRemaining > 0 ? `with ${yearsRemaining} year${yearsRemaining === 1 ? '' : 's'} left` : 'with his contract status still in flux'}, he remains an important roster asset.`;
};

export const buildPlayerDetailsModel = ({
  source,
  roster,
  teams,
  userTeamAbbr,
  capSpace,
  capLimit,
}: BuildPlayerDetailsOptions): PlayerDetailsModel => {
  const name = getSourceDisplayName(source);
  const position = getSourcePosition(source);
  const age = getSourceAge(source);
  const rating = getSourceRating(source);
  const teamAbbr = inferTeamAbbr(source, userTeamAbbr);
  const team = teams.find((entry) => entry.abbr === teamAbbr) ?? null;
  const contract = getContractSnapshot(source);
  const roleRank = inferRoleRank(source, roster);
  const activeRoster = roster.filter((player) => player.status?.toLowerCase() !== 'cut');
  const trajectory = computeFranchiseTrajectory({
    roster: activeRoster,
    teamOverview: team?.teamOverview ?? null,
    capSpace,
    capLimit,
  });
  const loyaltyScore = buildLoyaltyScore(source, teamAbbr, contract.yearsRemaining);
  const roleScore = buildRoleSatisfactionScore(rating, roleRank);
  const happinessScore = buildHappinessScore({
    source,
    rating,
    roleScore,
    apy: contract.apy,
  });
  const motivationScore = buildMotivationScore({
    source,
    trajectoryState: trajectory.state,
    yearsRemaining: contract.yearsRemaining,
  });
  const contractValueTag = buildContractValueTag({
    age,
    rating,
    apy: contract.apy,
    yearsRemaining: contract.yearsRemaining,
  });
  const playerTypeIndicator = getPlayerTypeIndicator({
    age: age ?? undefined,
    rating: rating ?? undefined,
  });
  const bestRole = bestRoleLabel(position, roleRank);
  const stats = buildStatsSnapshot(position, getSourceStats(source)).slice(0, 4);
  const tags = buildTags({
    source,
    rating,
    age,
    roleRank,
    yearsRemaining: contract.yearsRemaining,
    contractValueTag,
    position,
  });
  const contractItems = [
    { label: 'Cap Hit', value: contract.capHitLabel },
    { label: 'Years Remaining', value: formatContractYears(contract.yearsRemaining) },
    {
      label: 'Final Year',
      value: contract.finalYear ? String(contract.finalYear) : '—',
    },
    {
      label: 'APY / Market',
      value:
        contract.apy !== null
          ? formatMoneyMillions(contract.apy)
          : contract.marketValue !== null
            ? formatMoneyMillions(contract.marketValue)
            : '—',
    },
  ];

  return {
    id: source.player.id,
    name,
    position,
    age,
    height: getSourceHeight(source),
    weight: getSourceWeight(source),
    headshotUrl: getSourceHeadshot(source),
    teamName: team?.name ?? null,
    teamAbbr,
    teamLogoUrl: getTeamLogoUrl(team),
    rating,
    ratingDisplay: rating !== null ? String(rating) : '—',
    playerTypeLabel: playerTypeIndicator?.label ?? null,
    playerTypeIndicator,
    contractStatusLine: contract.status,
    bestRole,
    summary: buildSummary({
      teamName: team?.name ?? null,
      position,
      rating,
      age,
      roleRank,
      contractValueTag,
      source,
      yearsRemaining: contract.yearsRemaining,
    }),
    outlook: buildOutlook({
      age,
      rating,
      trajectoryState: trajectory.state,
      yearsRemaining: contract.yearsRemaining,
    }),
    contractValueTag,
    contract: contractItems,
    meters: [
      {
        key: 'loyalty',
        label: 'Loyalty',
        tier: toTier(loyaltyScore),
        value: loyaltyScore,
        helper: 'Built from team continuity and long-term connection.',
      },
      {
        key: 'happiness',
        label: 'Happiness',
        tier: toTier(happinessScore),
        value: happinessScore,
        helper: 'Estimated from pay, role, and current career stage.',
      },
      {
        key: 'motivation',
        label: 'Motivation',
        tier: toTier(motivationScore),
        value: motivationScore,
        helper: 'Driven by team outlook, age curve, and contract timing.',
      },
      {
        key: 'role',
        label: 'Satisfaction',
        tier: toTier(roleScore),
        value: roleScore,
        helper: 'Based on where the player projects in the current room.',
      },
    ],
    stats,
    tags,
  };
};
