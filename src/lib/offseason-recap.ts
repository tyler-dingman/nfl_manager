import { computeFranchiseTrajectory } from '@/lib/franchise-trajectory';
import { computeTeamOverviewRaw, resolvePlayerRating, scaleOverviewScore } from '@/lib/team-overview';
import type { PlayerRowDTO } from '@/types/player';
import type { TeamDTO } from '@/types/team';

export type DraftRecapSnapshot = {
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
};

export type OffseasonImpactAddition = {
  id: string;
  name: string;
  position: string;
  headshotUrl?: string | null;
  rating: number;
  acquisitionType: 'Signed' | 'Traded For' | 'Drafted';
  note: string;
  score: number;
};

export const approximateTrajectoryFromOverall = (overall: number | null | undefined) => {
  const value = overall ?? 72;
  if (value >= 87) return 'Contender';
  if (value >= 82) return 'Rising';
  if (value >= 77) return 'Balanced';
  if (value >= 72) return 'Declining';
  return 'Rebuilding';
};

const buildImpactNote = (
  addition: OffseasonImpactAddition,
  teamNeeds: string[],
  playerPosition: string,
) => {
  const normalizedNeeds = teamNeeds.map((need) => need.toUpperCase());
  const isNeedHit = normalizedNeeds.includes(playerPosition.toUpperCase());

  if (addition.acquisitionType === 'Drafted') {
    return isNeedHit
      ? 'Drafted to fill a clear roster need with starter upside.'
      : 'Draft class value with a chance to contribute early.';
  }
  if (addition.acquisitionType === 'Signed') {
    return isNeedHit
      ? 'Free-agent addition who should help immediately at a position of need.'
      : 'Veteran signing who raises the floor of the roster.';
  }
  return isNeedHit
    ? 'Trade addition who addresses a major weakness right away.'
    : 'Trade pickup with a realistic path to immediate snaps.';
};

export const computeLiveOverall = ({
  roster,
  teams,
  selectedTeam,
}: {
  roster: PlayerRowDTO[];
  teams: TeamDTO[];
  selectedTeam: TeamDTO | null;
}) => {
  if (roster.length === 0) {
    return selectedTeam?.teamOverview ?? null;
  }

  const rawOverview = computeTeamOverviewRaw(roster);
  const teamsWithRawOverview = teams.filter(
    (team): team is TeamDTO & { teamOverviewRaw: number } =>
      typeof team.teamOverviewRaw === 'number' && Number.isFinite(team.teamOverviewRaw),
  );
  const overallRawValues = teamsWithRawOverview.map((team) => team.teamOverviewRaw);

  if (overallRawValues.length <= 1) {
    return selectedTeam?.teamOverview ?? null;
  }

  return scaleOverviewScore(
    rawOverview.overall,
    Math.min(...overallRawValues),
    Math.max(...overallRawValues),
    69,
    91,
  );
};

export const selectTopOffseasonAdditions = ({
  roster,
  teamAbbr,
  teamNeeds,
  latestDraftRecap,
}: {
  roster: PlayerRowDTO[];
  teamAbbr: string;
  teamNeeds: string[];
  latestDraftRecap: DraftRecapSnapshot | null;
}): OffseasonImpactAddition[] => {
  const draftedIds = new Set(latestDraftRecap?.draftedPlayers.map((player) => player.id) ?? []);
  const draftAdditions: OffseasonImpactAddition[] =
    latestDraftRecap?.draftedPlayers.map((player) => ({
      id: player.id,
      name: player.name,
      position: player.position,
      headshotUrl: player.headshotUrl ?? null,
      rating: player.rating ?? 72,
      acquisitionType: 'Drafted',
      note: '',
      score: (player.rating ?? 72) + Math.max(0, 28 - player.pickOverall) * 0.45,
    })) ?? [];

  const otherAdditions = roster
    .filter((player) => !draftedIds.has(player.id))
    .map((player) => {
      const rating = resolvePlayerRating(player) ?? player.rating ?? player.maddenRating ?? 70;
      const isSigned = Boolean(player.signedAt && player.signedTeamAbbr === teamAbbr);
      const isTraded =
        player.currentTeamAbbr === teamAbbr &&
        Boolean(player.lastTeamAbbr) &&
        player.lastTeamAbbr !== teamAbbr &&
        !isSigned;

      if (!isSigned && !isTraded) {
        return null;
      }

      return {
        id: player.id,
        name: `${player.firstName} ${player.lastName}`.trim(),
        position: player.position,
        headshotUrl: player.headshotUrl ?? null,
        rating,
        acquisitionType: isSigned ? ('Signed' as const) : ('Traded For' as const),
        note: '',
        score: rating + (teamNeeds.includes(player.position) ? 7 : 0),
      };
    })
    .reduce<
      Array<{
        id: string;
        name: string;
        position: string;
        headshotUrl: string | null;
        rating: number;
        acquisitionType: 'Signed' | 'Traded For';
        note: string;
        score: number;
      }>
    >((acc, player) => {
      if (player) {
        acc.push(player);
      }
      return acc;
    }, []);

  return [...draftAdditions, ...otherAdditions]
    .map((player) => ({
      ...player,
      note: buildImpactNote(player, teamNeeds, player.position),
    }))
    .sort((left, right) => right.score - left.score)
    .slice(0, 3);
};

export const buildOffseasonSummary = ({
  startingOverall,
  endingOverall,
  startingTrajectory,
  endingTrajectory,
  capDelta,
  needsAddressed,
}: {
  startingOverall: number | null;
  endingOverall: number | null;
  startingTrajectory: string;
  endingTrajectory: string;
  capDelta: number | null;
  needsAddressed: number;
}) => {
  const lines: string[] = [];
  const overallDelta =
    startingOverall !== null && endingOverall !== null ? endingOverall - startingOverall : null;

  if (overallDelta !== null && overallDelta >= 2) {
    lines.push('The roster came out of the offseason stronger on paper and deeper in key spots.');
  } else if (overallDelta !== null && overallDelta <= -1) {
    lines.push('The offseason asked for some long-view bets, even if the short-term roster took on risk.');
  } else {
    lines.push('The offseason kept the roster competitive while reshaping key areas.');
  }

  if (needsAddressed >= 2) {
    lines.push('Multiple top needs were addressed, giving the roster a cleaner path into the season.');
  } else if (needsAddressed === 1) {
    lines.push('One major need was addressed, but there is still work to do at the back end of the roster.');
  } else {
    lines.push('The class leaned more toward value than direct need-filling, which leaves some pressure points.');
  }

  if (startingTrajectory !== endingTrajectory) {
    lines.push(`Team outlook shifted from ${startingTrajectory} to ${endingTrajectory}.`);
  }

  if (capDelta !== null) {
    lines.push(
      capDelta >= 0
        ? 'Cap flexibility held up well enough to support the moves that mattered.'
        : 'Cap room tightened, but the roster gained enough talent to justify the spend.',
    );
  }

  return lines.slice(0, 3);
};

export const computeEndingTrajectory = ({
  roster,
  overall,
  capSpace,
  capLimit,
}: {
  roster: PlayerRowDTO[];
  overall: number | null;
  capSpace: number;
  capLimit: number;
}) =>
  computeFranchiseTrajectory({
    roster,
    teamOverview: overall,
    capSpace,
    capLimit,
  }).state;
