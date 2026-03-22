import {
  computeTeamNeeds,
  normalizeOverviewPosition,
  resolvePlayerRating,
  type TeamNeed,
} from '@/lib/team-overview';
import type { PlayerRowDTO } from '@/types/player';

export type ChainReactionMoveType = 'freeAgency' | 'trade';

export type ChainReactionEffect = {
  id: string;
  message: string;
};

export type ChainReactionAnalysis = {
  effects: ChainReactionEffect[];
  surplusPositions: TeamNeed[];
  improvedPositions: TeamNeed[];
  capImpactDirection: 'up' | 'down' | 'flat';
  tradeOfferTriggers: TeamNeed[];
};

const STARTER_COUNT: Record<TeamNeed, number> = {
  QB: 1,
  RB: 2,
  WR: 3,
  TE: 1,
  OT: 2,
  IOL: 3,
  EDGE: 2,
  DL: 2,
  LB: 3,
  CB: 3,
  S: 2,
};

const DISPLAY_LABEL: Record<TeamNeed, string> = {
  QB: 'QB',
  RB: 'RB',
  WR: 'WR',
  TE: 'TE',
  OT: 'OT',
  IOL: 'OL',
  EDGE: 'EDGE',
  DL: 'DL',
  LB: 'LB',
  CB: 'CB',
  S: 'secondary',
};

const toNeedGroup = (position: string): TeamNeed | null => {
  const bucket = normalizeOverviewPosition(position);
  switch (bucket) {
    case 'QB':
      return 'QB';
    case 'RB':
      return 'RB';
    case 'WR':
      return 'WR';
    case 'TE':
      return 'TE';
    case 'LT':
    case 'RT':
      return 'OT';
    case 'LG':
    case 'C':
    case 'RG':
      return 'IOL';
    case 'EDGE':
      return 'EDGE';
    case 'DL':
      return 'DL';
    case 'LB':
      return 'LB';
    case 'CB':
      return 'CB';
    case 'S':
      return 'S';
    default:
      return null;
  }
};

const average = (values: number[]) =>
  values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;

const buildRoomMap = (roster: PlayerRowDTO[]) => {
  const grouped = new Map<TeamNeed, number[]>();
  roster.forEach((player) => {
    const rating = resolvePlayerRating(player);
    const group = toNeedGroup(player.position);
    if (rating === null || !group) return;
    const room = grouped.get(group) ?? [];
    room.push(rating);
    grouped.set(group, room);
  });
  grouped.forEach((ratings) => ratings.sort((left, right) => right - left));
  return grouped;
};

const roomStrength = (grouped: Map<TeamNeed, number[]>, position: TeamNeed) => {
  const starterCount = STARTER_COUNT[position];
  return average((grouped.get(position) ?? []).slice(0, starterCount));
};

const roomDepth = (grouped: Map<TeamNeed, number[]>, position: TeamNeed, threshold = 77) =>
  (grouped.get(position) ?? []).filter((rating) => rating >= threshold).length;

export const generateChainReactionEffects = ({
  beforeRoster,
  afterRoster,
  beforeCapSpace,
  afterCapSpace,
  moveType,
  player,
}: {
  beforeRoster: PlayerRowDTO[];
  afterRoster: PlayerRowDTO[];
  beforeCapSpace: number;
  afterCapSpace: number;
  moveType: ChainReactionMoveType;
  player: Pick<PlayerRowDTO, 'position'>;
}): ChainReactionAnalysis | null => {
  const focusPosition = toNeedGroup(player.position);
  if (!focusPosition) {
    return null;
  }

  const beforeRooms = buildRoomMap(beforeRoster);
  const afterRooms = buildRoomMap(afterRoster);
  const beforeNeeds = computeTeamNeeds(beforeRoster);
  const afterNeeds = computeTeamNeeds(afterRoster);
  const focusLabel = DISPLAY_LABEL[focusPosition];
  const improvement =
    roomStrength(afterRooms, focusPosition) - roomStrength(beforeRooms, focusPosition);
  const beforeDepth = roomDepth(beforeRooms, focusPosition);
  const afterDepth = roomDepth(afterRooms, focusPosition);
  const capDelta = Number((afterCapSpace - beforeCapSpace).toFixed(1));
  const effects: ChainReactionEffect[] = [];
  const surplusPositions: TeamNeed[] = [];
  const improvedPositions: TeamNeed[] = [];
  const tradeOfferTriggers: TeamNeed[] = [];

  if (improvement >= 2) {
    effects.push({ id: 'room-upgraded', message: `${focusLabel} room upgraded` });
    improvedPositions.push(focusPosition);
  }

  if (beforeNeeds.includes(focusPosition) && !afterNeeds.includes(focusPosition)) {
    effects.push({ id: 'bpa', message: 'BPA flexibility improved' });
  }

  if (afterDepth >= STARTER_COUNT[focusPosition] + 1 && afterDepth > beforeDepth) {
    effects.push({
      id: 'leverage',
      message: moveType === 'trade' ? 'Trade leverage increased' : `${focusLabel} room now crowded`,
    });
    surplusPositions.push(focusPosition);
    tradeOfferTriggers.push(focusPosition);
  }

  if (
    (afterRooms.get(focusPosition) ?? []).length > STARTER_COUNT[focusPosition] &&
    ((afterRooms.get(focusPosition) ?? [])[STARTER_COUNT[focusPosition]] ?? 0) >= 74
  ) {
    effects.push({ id: 'buried-starter', message: 'Veteran starter now expendable' });
  }

  if (capDelta <= -8) {
    effects.push({ id: 'cap-down', message: 'Cap flexibility reduced' });
  } else if (capDelta <= -4) {
    effects.push({ id: 'cap-tight', message: 'Short-term cap flexibility trimmed' });
  }

  if (effects.length < 2 && afterDepth > beforeDepth) {
    effects.push({
      id: 'inbound-interest',
      message: `Inbound calls at ${focusLabel} could increase`,
    });
    tradeOfferTriggers.push(focusPosition);
  }

  if (effects.length < 2) {
    return null;
  }

  return {
    effects: effects.slice(0, 4),
    surplusPositions,
    improvedPositions,
    capImpactDirection: capDelta > 1 ? 'up' : capDelta < -1 ? 'down' : 'flat',
    tradeOfferTriggers,
  };
};
