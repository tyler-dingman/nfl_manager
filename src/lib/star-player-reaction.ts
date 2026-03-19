import { resolvePlayerRating } from '@/lib/team-overview';
import type { PlayerRowDTO } from '@/types/player';

export type StarReactionActionType = 'freeAgency' | 'trade';
export type PlayerSide = 'offense' | 'defense';

export type StarReactionToastPayload = {
  displayName: string;
  subtitle: string;
  message: string;
  headshotUrl: string | null;
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

const MESSAGE_TEMPLATES = [
  '💪',
  'Let’s gooooooo 🎉',
  'Welcome to my guy {firstName}! 🙌',
  'Making moves! Welcome {firstName}! 💪',
  'Showtime! 🏆',
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
  const trimmedTeamName = teamName?.trim();
  if (trimmedTeamName) {
    const parts = trimmedTeamName.split(/\s+/);
    return `${parts[parts.length - 1]} Locker Room`;
  }
  return teamAbbr ? `${teamAbbr} Locker Room` : 'Locker Room';
};

const hashString = (value: string) => {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
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

export const getTopRatedRosterPlayerBySide = (
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
    })[0] ?? null;

export const getReactionMessage = ({
  incomingPlayer,
  actionType,
  reactingPlayerId,
}: {
  incomingPlayer: Pick<PlayerRowDTO, 'id' | 'firstName' | 'lastName'>;
  actionType: StarReactionActionType;
  reactingPlayerId: string;
}) => {
  const firstName = getIncomingFirstName(incomingPlayer);
  const seed = `${actionType}:${incomingPlayer.id}:${reactingPlayerId}`;
  const template = MESSAGE_TEMPLATES[hashString(seed) % MESSAGE_TEMPLATES.length] ?? MESSAGE_TEMPLATES[0];
  return template.replace('{firstName}', firstName);
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
  if (!side || roster.length === 0) return null;

  const reactingPlayer = getTopRatedRosterPlayerBySide(roster, side, incomingPlayer.id);
  if (!reactingPlayer) return null;

  const displayName = getDisplayName(reactingPlayer);
  if (!displayName) return null;

  return {
    displayName,
    subtitle: buildTeamSubtitle(teamName, teamAbbr),
    message: getReactionMessage({
      incomingPlayer,
      actionType,
      reactingPlayerId: reactingPlayer.id,
    }),
    headshotUrl: reactingPlayer.headshotUrl ?? null,
  };
};
