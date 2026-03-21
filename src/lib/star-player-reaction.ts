import { resolvePlayerRating } from '@/lib/team-overview';
import { getTeamFlavorHandle } from '@/lib/team-flavor';
import type { PlayerRowDTO } from '@/types/player';

export type StarReactionActionType = 'freeAgency' | 'trade' | 'resign' | 'cut';
export type PlayerSide = 'offense' | 'defense';

export type StarReactionToastPayload = {
  displayName: string;
  handle: string;
  subtitle: string;
  timestampLabel: string;
  message: string;
  headshotUrl: string | null;
  likes: string;
  reposts: string;
  replies: string;
  views?: string;
};

const OFFENSIVE_POSITIONS = new Set([
  'QB',
  'RB',
  'HB',
  'FB',
  'WR',
  'TE',
  'LT',
  'LG',
  'C',
  'RG',
  'RT',
  'OL',
  'OT',
  'IOL',
]);

const DEFENSIVE_POSITIONS = new Set([
  'EDGE',
  'ED',
  'DE',
  'LE',
  'RE',
  'DT',
  'NT',
  'DL',
  'LB',
  'MLB',
  'ILB',
  'OLB',
  'LOLB',
  'ROLB',
  'CB',
  'DB',
  'S',
  'FS',
  'SS',
]);

const OFFENSIVE_MESSAGE_TEMPLATES = [
  '💪',
  'Let’s gooooooo 🎉',
  'Welcome my guy {firstName}! 🙌',
  'Making moves! Welcome {firstName}! 💪',
  'Showtime! 🏆',
  'Love this move. Let’s work {firstName} 🔥',
  'Big pickup. Let’s get after it {firstName} 👀',
  'Oh yeah we cooking now 😤',
  'This offense just got better. Welcome {firstName} ⚡',
  'Say less. Let’s ball {firstName} 🏈',
] as const;

const DEFENSIVE_MESSAGE_TEMPLATES = [
  '😤',
  'Locking it down now. Welcome {firstName} 🔒',
  'Defense got better today. Let’s go {firstName} 💪',
  'Love this one. Welcome {firstName} 🧱',
  'We got another dog. Let’s work {firstName} 🐺',
  'Say less. Time to fly around 🔥',
  'Big-time move for this defense 🛡️',
  'Let’s hunt {firstName} 😈',
  'This unit just leveled up 💥',
  'Welcome to the squad {firstName}. Let’s get it 🙌',
] as const;

const RESIGN_MESSAGE_TEMPLATES = [
  'Run it back!! 🔥',
  'Glad we kept {firstName} in the building 💪',
  'Wouldn’t want to do this without {firstName} 🙌',
  'Huge to bring {firstName} back 🏆',
  'Loyalty. Love to see it ❤️',
  'Let’s keep building together {firstName} 😤',
] as const;

const CUT_OFFENSIVE_MESSAGE_TEMPLATES = [
  'Sad to see my dog {firstName} go... 😔',
  'This one hurts. Going to miss {firstName} in the huddle.',
  'Going to miss my dog {firstName}... tough one.',
  'Hate seeing {firstName} leave the room. Wishing him the best.',
  '{firstName} was one of ours. This one stings.',
] as const;

const CUT_DEFENSIVE_MESSAGE_TEMPLATES = [
  'Sad to see my dog {firstName} go... 😔',
  'This one hurts. Going to miss {firstName} flying around with us.',
  'Going to miss my dog {firstName}... tough one.',
  'Hate seeing {firstName} leave this defense. Wishing him the best.',
  '{firstName} meant a lot to this unit. This one stings.',
] as const;

const normalizePosition = (position?: string | null) => position?.trim().toUpperCase() ?? '';

const getDisplayName = (player: Pick<PlayerRowDTO, 'firstName' | 'lastName'>) =>
  `${player.firstName ?? ''} ${player.lastName ?? ''}`.trim();

const getIncomingDisplayName = (
  player: Pick<PlayerRowDTO, 'firstName' | 'lastName'>,
  fallbackName?: string,
) => {
  const combined = getDisplayName(player);
  return combined || fallbackName || '';
};

const getIncomingFirstName = (
  player: Pick<PlayerRowDTO, 'firstName' | 'lastName'>,
  fallbackName?: string,
) => {
  const combined = getIncomingDisplayName(player, fallbackName);
  if (player.firstName?.trim()) return player.firstName.trim();
  const [firstToken] = combined.split(/\s+/);
  return firstToken || combined;
};

const buildTeamSubtitle = (teamName?: string | null, teamAbbr?: string | null) => {
  const handle = getTeamFlavorHandle(teamAbbr);
  if (handle && handle !== 'Franchise Football') {
    return handle;
  }
  const trimmedTeamName = teamName?.trim();
  if (trimmedTeamName) {
    const parts = trimmedTeamName.split(/\s+/);
    return `${parts[parts.length - 1]} Locker Room`;
  }
  return teamAbbr ? `${teamAbbr} Locker Room` : 'Locker Room';
};

const buildTeamSocialDisplayName = (teamName?: string | null, teamAbbr?: string | null) => {
  const trimmedTeamName = teamName?.trim();
  if (trimmedTeamName) return `${trimmedTeamName} Social`;
  return teamAbbr ? `${teamAbbr} Social` : 'Team Social';
};

const buildHandle = (player: Pick<PlayerRowDTO, 'firstName' | 'lastName'>, rating?: number | null) => {
  const raw = `${player.firstName ?? ''}${player.lastName ?? ''}`.replace(/[^a-z0-9]/gi, '');
  const trimmed = raw.slice(0, 18) || 'FranchiseStar';
  const suffix = typeof rating === 'number' && rating >= 94 ? `${rating}` : '';
  return `@${trimmed}${suffix}`;
};

const buildTeamHandle = (teamName?: string | null, teamAbbr?: string | null) => {
  const compactName =
    teamName?.replace(/[^a-z0-9]/gi, '').slice(0, 14) ||
    teamAbbr?.replace(/[^a-z0-9]/gi, '').slice(0, 10) ||
    'Franchise';
  return `@${compactName}HQ`;
};

const hashString = (value: string) => {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
};

const hashToUnit = (seed: string) => (hashString(seed) % 1000) / 999;

const formatEngagementCount = (value: number) => {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1).replace(/\.0$/, '')}K`;
  return `${Math.round(value)}`;
};

export const isOffensivePosition = (position?: string | null) =>
  OFFENSIVE_POSITIONS.has(normalizePosition(position));

export const isDefensivePosition = (position?: string | null) =>
  DEFENSIVE_POSITIONS.has(normalizePosition(position));

export const getPlayerSide = (position?: string | null): PlayerSide | null => {
  if (isOffensivePosition(position)) return 'offense';
  if (isDefensivePosition(position)) return 'defense';
  return null;
};

export const getTopRatedRosterPlayerOverall = (
  roster: PlayerRowDTO[],
  excludedPlayerId?: string | null,
) =>
  getTopRatedRosterPlayersOverall(roster, excludedPlayerId)[0] ?? null;

export const getTopRatedRosterPlayersOverall = (
  roster: PlayerRowDTO[],
  excludedPlayerId?: string | null,
) =>
  roster
    .filter((player) => {
      if (!getDisplayName(player)) return false;
      if (excludedPlayerId && player.id === excludedPlayerId) return false;
      return resolvePlayerRating(player) !== null;
    })
    .sort((left, right) => {
      const rightRating = resolvePlayerRating(right) ?? -1;
      const leftRating = resolvePlayerRating(left) ?? -1;
      if (rightRating !== leftRating) return rightRating - leftRating;
      if (Boolean(right.headshotUrl) !== Boolean(left.headshotUrl)) {
        return right.headshotUrl ? 1 : -1;
      }
      return getDisplayName(left).localeCompare(getDisplayName(right));
    });

export const getTopRatedRosterPlayerBySide = (
  roster: PlayerRowDTO[],
  side: PlayerSide,
  excludedPlayerId?: string | null,
) =>
  getTopRatedRosterPlayersBySide(roster, side, excludedPlayerId)[0] ?? null;

export const getTopRatedRosterPlayersBySide = (
  roster: PlayerRowDTO[],
  side: PlayerSide,
  excludedPlayerId?: string | null,
) =>
  roster
    .filter((player) => {
      if (!getDisplayName(player)) return false;
      if (excludedPlayerId && player.id === excludedPlayerId) return false;
      return getPlayerSide(player.position) === side && resolvePlayerRating(player) !== null;
    })
    .sort((left, right) => {
      const rightRating = resolvePlayerRating(right) ?? -1;
      const leftRating = resolvePlayerRating(left) ?? -1;
      if (rightRating !== leftRating) return rightRating - leftRating;
      if (Boolean(right.headshotUrl) !== Boolean(left.headshotUrl)) {
        return right.headshotUrl ? 1 : -1;
      }
      return getDisplayName(left).localeCompare(getDisplayName(right));
    });

const pickReactionAuthor = ({
  candidates,
  seed,
}: {
  candidates: PlayerRowDTO[];
  seed: string;
}) => {
  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0];
  return candidates[hashString(seed) % Math.min(2, candidates.length)] ?? candidates[0];
};

export const getReactionMessage = ({
  incomingPlayer,
  actionType,
  reactingPlayerId,
  side,
}: {
  incomingPlayer: Pick<PlayerRowDTO, 'id' | 'firstName' | 'lastName'>;
  actionType: StarReactionActionType;
  reactingPlayerId: string;
  side: PlayerSide | null;
}) => {
  const firstName = getIncomingFirstName(incomingPlayer);
  const seed = `${actionType}:${incomingPlayer.id}:${reactingPlayerId}`;
  const templates =
    actionType === 'resign'
      ? RESIGN_MESSAGE_TEMPLATES
      : actionType === 'cut'
        ? side === 'defense'
          ? CUT_DEFENSIVE_MESSAGE_TEMPLATES
          : CUT_OFFENSIVE_MESSAGE_TEMPLATES
      : side === 'defense'
        ? DEFENSIVE_MESSAGE_TEMPLATES
        : OFFENSIVE_MESSAGE_TEMPLATES;
  const template = templates[hashString(seed) % templates.length] ?? templates[0];
  return template.replace('{firstName}', firstName);
};

const getMoveWeight = (actionType: StarReactionActionType) => {
  if (actionType === 'trade') return 1.2;
  if (actionType === 'freeAgency') return 1.05;
  if (actionType === 'cut') return 0.82;
  return 0.9;
};

export const generateEngagementCounts = ({
  actionType,
  authorRating,
  acquiredPlayerRating,
  seed,
}: {
  actionType: StarReactionActionType;
  authorRating: number;
  acquiredPlayerRating: number;
  seed: string;
}) => {
  const moveWeight = getMoveWeight(actionType);
  const starWeight = Math.max(0.8, (authorRating + acquiredPlayerRating) / 180);

  const replies =
    24 + Math.round((850 - 24) * Math.min(1, hashToUnit(`${seed}:replies`) * moveWeight * starWeight));
  const reposts =
    100 +
    Math.round((4_500 - 100) * Math.min(1, hashToUnit(`${seed}:reposts`) * moveWeight * starWeight));
  const likes =
    900 +
    Math.round((28_000 - 900) * Math.min(1, hashToUnit(`${seed}:likes`) * moveWeight * starWeight));
  const views =
    18_000 +
    Math.round(
      (1_200_000 - 18_000) * Math.min(1, hashToUnit(`${seed}:views`) * (moveWeight + 0.05) * starWeight),
    );

  return {
    replies: formatEngagementCount(replies),
    reposts: formatEngagementCount(reposts),
    likes: formatEngagementCount(likes),
    views: formatEngagementCount(views),
  };
};

export const buildStarReactionToastPayload = ({
  incomingPlayer,
  roster,
  actionType,
  teamAbbr,
  teamName,
}: {
  incomingPlayer: Pick<PlayerRowDTO, 'id' | 'firstName' | 'lastName' | 'position'>;
  roster: PlayerRowDTO[];
  actionType: StarReactionActionType;
  teamAbbr?: string | null;
  teamName?: string | null;
}): StarReactionToastPayload | null => {
  const side = getPlayerSide(incomingPlayer.position);
  if (roster.length === 0) return null;

  const reactionSeed = `${actionType}:${incomingPlayer.id}:${incomingPlayer.position ?? 'unknown'}`;
  const sameSideCandidates = side
    ? [
        ...getTopRatedRosterPlayersBySide(roster, side, incomingPlayer.id),
        ...getTopRatedRosterPlayersBySide(roster, side),
      ].filter(
        (player, index, candidates) =>
          candidates.findIndex((candidate) => candidate.id === player.id) === index,
      )
    : [];

  const overallCandidates = [
    ...getTopRatedRosterPlayersOverall(roster, incomingPlayer.id),
    ...getTopRatedRosterPlayersOverall(roster),
  ].filter(
    (player, index, candidates) =>
      candidates.findIndex((candidate) => candidate.id === player.id) === index,
  );

  const reactingPlayer =
    pickReactionAuthor({
      candidates: side ? sameSideCandidates : [],
      seed: `${reactionSeed}:side`,
    }) ??
    pickReactionAuthor({
      candidates: overallCandidates,
      seed: `${reactionSeed}:overall`,
    });

  const displayName = reactingPlayer
    ? getDisplayName(reactingPlayer)
    : buildTeamSocialDisplayName(teamName, teamAbbr);
  if (!displayName) return null;

  const engagement = generateEngagementCounts({
    actionType,
    authorRating: reactingPlayer ? (resolvePlayerRating(reactingPlayer) ?? 82) : 84,
    acquiredPlayerRating: resolvePlayerRating(incomingPlayer) ?? 80,
    seed: `${actionType}:${incomingPlayer.id}:${reactingPlayer?.id ?? teamAbbr ?? 'team'}`,
  });

  return {
    displayName,
    handle: reactingPlayer
      ? buildHandle(reactingPlayer, resolvePlayerRating(reactingPlayer))
      : buildTeamHandle(teamName, teamAbbr),
    subtitle: buildTeamSubtitle(teamName, teamAbbr),
    timestampLabel: 'now',
    message: getReactionMessage({
      incomingPlayer,
      actionType,
      reactingPlayerId: reactingPlayer?.id ?? `${teamAbbr ?? 'team'}-social`,
      side,
    }),
    headshotUrl: reactingPlayer?.headshotUrl ?? null,
    likes: engagement.likes,
    reposts: engagement.reposts,
    replies: engagement.replies,
    views: engagement.views,
  };
};
