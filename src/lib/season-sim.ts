import { computeFranchiseTrajectory } from '@/lib/franchise-trajectory';
import { selectTopOffseasonAdditions } from '@/lib/offseason-recap';
import { getTopRatedRosterPlayerOverall } from '@/lib/star-player-reaction';
import {
  computeTeamNeeds,
  computeTeamOverviewRaw,
  resolvePlayerRating,
  scaleOverviewScore,
} from '@/lib/team-overview';
import type {
  SeasonImpactAddition,
  SeasonLeaderStat,
  SeasonOutcome,
  SeasonRecapSnapshot,
} from '@/types/franchise';
import type { PlayerRowDTO } from '@/types/player';
import type { TeamDTO } from '@/types/team';

type DraftRecapLike = {
  teamName: string;
  teamAbbr: string;
  roundCount: number;
  overallGrade: string;
  summaryLines: string[];
  needsAddressed: string[];
  remainingNeeds: string[];
  draftedPlayers: Array<{
    id: string;
    name: string;
    position: string;
    school?: string | null;
    pickOverall: number;
    pickRound: number;
    grade: string;
    headshotUrl?: string | null;
    rating?: number | null;
  }>;
} | null;

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const hashString = (value: string) => {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
};

const unitFromSeed = (seed: string) => (hashString(seed) % 10_000) / 9_999;

const signedCount = (roster: PlayerRowDTO[], teamAbbr: string) =>
  roster.filter((player) => Boolean(player.signedAt) && player.signedTeamAbbr === teamAbbr).length;

const tradedForCount = (roster: PlayerRowDTO[], teamAbbr: string) =>
  roster.filter(
    (player) =>
      player.currentTeamAbbr === teamAbbr &&
      Boolean(player.lastTeamAbbr) &&
      player.lastTeamAbbr !== teamAbbr &&
      !player.signedAt,
  ).length;

const getTeamOverviewForRoster = ({
  roster,
  selectedTeam,
  teams,
}: {
  roster: PlayerRowDTO[];
  selectedTeam: TeamDTO | null;
  teams: TeamDTO[];
}) => {
  if (roster.length === 0) {
    return selectedTeam?.teamOverview ?? null;
  }

  const rawOverview = computeTeamOverviewRaw(roster);
  const rawValues = teams
    .map((team) => team.teamOverviewRaw)
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));

  if (rawValues.length <= 1) {
    return selectedTeam?.teamOverview ?? null;
  }

  return scaleOverviewScore(
    rawOverview.overall,
    Math.min(...rawValues),
    Math.max(...rawValues),
    69,
    91,
  );
};

const pickBestByPosition = (roster: PlayerRowDTO[], positions: string[]) =>
  roster
    .filter((player) => positions.includes(player.position.toUpperCase()))
    .sort(
      (left, right) => (resolvePlayerRating(right) ?? 0) - (resolvePlayerRating(left) ?? 0),
    )[0] ?? null;

const pickBestPassCatcher = (roster: PlayerRowDTO[]) =>
  roster
    .filter((player) => ['WR', 'TE', 'RB'].includes(player.position.toUpperCase()))
    .sort(
      (left, right) => (resolvePlayerRating(right) ?? 0) - (resolvePlayerRating(left) ?? 0),
    )[0] ?? null;

const pickBestDefender = (roster: PlayerRowDTO[], positions: string[]) =>
  roster
    .filter((player) => positions.includes(player.position.toUpperCase()))
    .sort(
      (left, right) => (resolvePlayerRating(right) ?? 0) - (resolvePlayerRating(left) ?? 0),
    )[0] ?? null;

const formatRecordNote = (wins: number): string => {
  if (wins >= 14) return 'best in the conference';
  if (wins >= 11) return 'division-title pace';
  if (wins >= 9) return 'firm playoff territory';
  if (wins >= 7) return 'hanging in the playoff race';
  return 'a frustrating climb';
};

const resolveSeasonOutcome = ({
  wins,
  overall,
  seed,
}: {
  wins: number;
  overall: number;
  seed: string;
}): { madePlayoffs: boolean; playoffSeed: number | null; seasonOutcome: SeasonOutcome } => {
  if (wins <= 8) {
    return { madePlayoffs: false, playoffSeed: null, seasonOutcome: 'Missed Playoffs' };
  }

  const unit = unitFromSeed(seed);
  const playoffSeed = clamp(8 - Math.floor((wins - 9) / 2), 1, 7);
  const strength = overall + wins * 0.8;

  if (strength >= 101 && unit > 0.78) {
    return { madePlayoffs: true, playoffSeed, seasonOutcome: 'Super Bowl Champion' };
  }
  if (strength >= 97 && unit > 0.62) {
    return { madePlayoffs: true, playoffSeed, seasonOutcome: 'Super Bowl Runner-Up' };
  }
  if (strength >= 92 && unit > 0.46) {
    return {
      madePlayoffs: true,
      playoffSeed,
      seasonOutcome: 'Conference Championship Exit',
    };
  }
  if (strength >= 87 && unit > 0.26) {
    return { madePlayoffs: true, playoffSeed, seasonOutcome: 'Divisional Exit' };
  }
  return { madePlayoffs: true, playoffSeed, seasonOutcome: 'Wild Card Exit' };
};

const buildLeader = (
  category: SeasonLeaderStat['category'],
  player: PlayerRowDTO | null,
  value: number,
): SeasonLeaderStat | null => {
  if (!player) return null;
  return {
    category,
    playerId: player.id,
    name: `${player.firstName} ${player.lastName}`.trim(),
    position: player.position,
    headshotUrl: player.headshotUrl ?? null,
    value,
    valueLabel: `${Math.round(value)}`,
  };
};

const buildSeasonLeaders = (
  roster: PlayerRowDTO[],
  wins: number,
  seed: string,
): SeasonLeaderStat[] => {
  const qb = pickBestByPosition(roster, ['QB']);
  const rb = pickBestByPosition(roster, ['RB', 'HB', 'FB']);
  const passCatcher = pickBestPassCatcher(roster);
  const topTackler =
    pickBestDefender(roster, ['LB', 'MLB', 'ILB', 'OLB', 'CB', 'S', 'FS', 'SS']) ??
    getTopRatedRosterPlayerOverall(roster);
  const topEdge =
    pickBestDefender(roster, ['EDGE', 'ED', 'DE', 'DL', 'DT']) ??
    getTopRatedRosterPlayerOverall(roster);
  const ballhawk =
    pickBestDefender(roster, ['CB', 'S', 'FS', 'SS', 'DB']) ??
    getTopRatedRosterPlayerOverall(roster);
  const winsFactor = wins * 0.05;
  const qbRating = resolvePlayerRating(qb ?? { position: 'QB' }) ?? 75;
  const rbRating = resolvePlayerRating(rb ?? { position: 'RB' }) ?? 72;
  const catcherRating = resolvePlayerRating(passCatcher ?? { position: 'WR' }) ?? 74;
  const tackleRating = resolvePlayerRating(topTackler ?? { position: 'LB' }) ?? 74;
  const sackRating = resolvePlayerRating(topEdge ?? { position: 'EDGE' }) ?? 76;
  const picksRating = resolvePlayerRating(ballhawk ?? { position: 'CB' }) ?? 75;

  const leaders = [
    buildLeader(
      'Passing Yards',
      qb,
      3100 + qbRating * 18 + wins * 34 + unitFromSeed(`${seed}:pass-yds`) * 280,
    ),
    buildLeader(
      'Pass TD',
      qb,
      17 + qbRating * 0.18 + winsFactor * 9 + unitFromSeed(`${seed}:pass-td`) * 6,
    ),
    buildLeader(
      'Rushing Yards',
      rb,
      620 + rbRating * 9 + wins * 18 + unitFromSeed(`${seed}:rush-yds`) * 160,
    ),
    buildLeader(
      'Rush TD',
      rb,
      4 + rbRating * 0.09 + winsFactor * 4 + unitFromSeed(`${seed}:rush-td`) * 3,
    ),
    buildLeader(
      'Receptions',
      passCatcher,
      58 + catcherRating * 0.28 + winsFactor * 8 + unitFromSeed(`${seed}:rec`) * 10,
    ),
    buildLeader(
      'Receiving Yards',
      passCatcher,
      780 + catcherRating * 9.2 + wins * 22 + unitFromSeed(`${seed}:rec-yds`) * 120,
    ),
    buildLeader(
      'Receiving TD',
      passCatcher,
      5 + catcherRating * 0.08 + winsFactor * 3 + unitFromSeed(`${seed}:rec-td`) * 2.5,
    ),
    buildLeader(
      'Tackles',
      topTackler,
      78 + tackleRating * 0.32 + unitFromSeed(`${seed}:tackles`) * 18,
    ),
    buildLeader('Sacks', topEdge, 5 + sackRating * 0.06 + unitFromSeed(`${seed}:sacks`) * 3.8),
    buildLeader(
      'Interceptions',
      ballhawk,
      2 + picksRating * 0.03 + unitFromSeed(`${seed}:ints`) * 2.1,
    ),
  ];

  return leaders.filter((leader): leader is SeasonLeaderStat => Boolean(leader));
};

const buildKeyNotes = ({
  impactAdditions,
  seasonOutcome,
  wins,
  teamName,
  remainingNeeds,
}: {
  impactAdditions: SeasonImpactAddition[];
  seasonOutcome: SeasonOutcome;
  wins: number;
  teamName: string;
  remainingNeeds: string[];
}) => {
  const notes: string[] = [];
  const topAddition = impactAdditions[0];
  if (topAddition) {
    notes.push(
      `${topAddition.name} gave ${teamName} an immediate jolt after arriving ${topAddition.acquisitionType.toLowerCase()}.`,
    );
  }
  if (remainingNeeds.length > 0) {
    notes.push(
      `${remainingNeeds[0]} still feels like a pressure point heading into the next offseason.`,
    );
  }
  if (seasonOutcome === 'Missed Playoffs') {
    notes.push(
      `The record settled at ${wins} wins, but the roster still showed enough backbone to keep building from here.`,
    );
  } else {
    notes.push(
      `The season ended with ${seasonOutcome.toLowerCase()}, proof that the offseason changes translated to Sundays.`,
    );
  }
  return notes.slice(0, 3);
};

export const simulateSeasonRecap = ({
  year,
  roster,
  teamAbbr,
  selectedTeam,
  teams,
  capSpace,
  capLimit,
  latestDraftRecap,
  startingOverall,
}: {
  year: number;
  roster: PlayerRowDTO[];
  teamAbbr: string;
  selectedTeam: TeamDTO | null;
  teams: TeamDTO[];
  capSpace: number;
  capLimit: number;
  latestDraftRecap: DraftRecapLike;
  startingOverall: number | null;
}): SeasonRecapSnapshot => {
  const activeRoster = roster.filter((player) => player.status?.toLowerCase() !== 'cut');
  const overall = getTeamOverviewForRoster({ roster: activeRoster, selectedTeam, teams });
  const needs = computeTeamNeeds(activeRoster);
  const trajectory = computeFranchiseTrajectory({
    roster: activeRoster,
    teamOverview: overall,
    capSpace,
    capLimit,
  });
  const teamName = selectedTeam?.name ?? teamAbbr;
  const impactAdditions = selectTopOffseasonAdditions({
    roster: activeRoster,
    teamAbbr,
    teamNeeds: selectedTeam?.teamNeeds ?? needs,
    latestDraftRecap,
  }) as SeasonImpactAddition[];
  const seed = `${teamAbbr}:${year}:${activeRoster.map((player) => player.id).join('|')}`;
  const topPlayers = activeRoster
    .map((player) => resolvePlayerRating(player))
    .filter((rating): rating is number => rating !== null)
    .sort((left, right) => right - left)
    .slice(0, 8);
  const topEndAverage =
    topPlayers.length > 0
      ? topPlayers.reduce((sum, rating) => sum + rating, 0) / topPlayers.length
      : 74;
  const balancePenalty = Math.max(0, needs.length - 3) * 0.18;
  const offseasonBoost =
    impactAdditions.length * 0.4 +
    (latestDraftRecap?.needsAddressed.length ?? 0) * 0.22 +
    signedCount(activeRoster, teamAbbr) * 0.08 +
    tradedForCount(activeRoster, teamAbbr) * 0.1;
  const variance = (unitFromSeed(seed) - 0.5) * 2.6;
  const projectedWins = clamp(
    Math.round(
      ((overall ?? selectedTeam?.teamOverview ?? 74) - 62) * 0.42 +
        (topEndAverage - 75) * 0.12 +
        offseasonBoost -
        balancePenalty +
        6.2 +
        variance,
    ),
    4,
    15,
  );
  const projectedLosses = 17 - projectedWins;
  const divisionFinish =
    projectedWins >= 12
      ? '1st in division'
      : projectedWins >= 10
        ? '2nd in division'
        : projectedWins >= 8
          ? '3rd in division'
          : '4th in division';
  const { madePlayoffs, playoffSeed, seasonOutcome } = resolveSeasonOutcome({
    wins: projectedWins,
    overall: overall ?? selectedTeam?.teamOverview ?? 74,
    seed,
  });
  const leaders = buildSeasonLeaders(activeRoster, projectedWins, seed);
  const overallDelta =
    overall !== null && startingOverall !== null ? overall - startingOverall : null;
  const summaryLines = [
    `${teamName} finished ${projectedWins}-${projectedLosses}, ${formatRecordNote(projectedWins)}, and came away with ${seasonOutcome.toLowerCase()}.`,
    madePlayoffs
      ? `The roster turned its offseason work into a playoff push, with the top of the depth chart carrying real weight.`
      : `The offseason helped stabilize the roster, but the climb was still limited by a few thin position groups.`,
    impactAdditions[0]
      ? `${impactAdditions[0].name} was one of the clearest signs that the offseason plan paid off quickly.`
      : `The season leaned on internal growth more than splash additions, but the trajectory still moved in the right direction.`,
  ];

  return {
    year,
    teamAbbr,
    teamName,
    wins: projectedWins,
    losses: projectedLosses,
    divisionFinish,
    playoffSeed,
    madePlayoffs,
    seasonOutcome,
    trajectory: trajectory.state,
    overall,
    overallDelta,
    summaryLines,
    keyNotes: buildKeyNotes({
      impactAdditions,
      seasonOutcome,
      wins: projectedWins,
      teamName,
      remainingNeeds: needs,
    }),
    leaders,
    impactAdditions,
  };
};
