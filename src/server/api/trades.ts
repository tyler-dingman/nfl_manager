import type { PlayerRowDTO } from '@/types/player';
import type { SaveHeaderDTO } from '@/types/save';

import {
  getSaveHeaderSnapshot,
  getSaveStateResult,
  type SaveResult,
} from './store';
import { parseMoneyMillions } from '@/server/logic/cap';

export type TradeSide = 'send' | 'receive';

export type TradeAssetDTO = {
  id: string;
  type: 'player' | 'pick';
  side: TradeSide;
  label: string;
  value: number;
  playerId?: string;
  pickId?: string;
};

export type TradeDTO = {
  id: string;
  saveId: string;
  partnerTeamAbbr: string;
  sendAssets: TradeAssetDTO[];
  receiveAssets: TradeAssetDTO[];
};

type StoredTradePlayer = PlayerRowDTO & {
  year1CapHit: number;
};

type TradeState = {
  trade: TradeDTO;
};

type TradeRosterResponse = {
  trade: TradeDTO;
  userRoster: PlayerRowDTO[];
  partnerRoster: PlayerRowDTO[];
};

const tradeStore = new Map<string, TradeState>();
const partnerRosterStore = new Map<string, StoredTradePlayer[]>();

const BASE_PARTNER_PLAYERS: StoredTradePlayer[] = [
  {
    id: 'p1',
    firstName: 'Amon-Ra',
    lastName: 'St. Brown',
    position: 'WR',
    contractYearsRemaining: 3,
    capHit: '$9.6M',
    status: 'Active',
    headshotUrl: null,
    year1CapHit: 9.6,
  },
  {
    id: 'p2',
    firstName: 'Micah',
    lastName: 'Parsons',
    position: 'LB',
    contractYearsRemaining: 2,
    capHit: '$8.3M',
    status: 'Active',
    headshotUrl: null,
    year1CapHit: 8.3,
  },
  {
    id: 'p3',
    firstName: 'Bijan',
    lastName: 'Robinson',
    position: 'RB',
    contractYearsRemaining: 4,
    capHit: '$5.4M',
    status: 'Active',
    headshotUrl: null,
    year1CapHit: 5.4,
  },
  {
    id: 'p4',
    firstName: 'Patrick',
    lastName: 'Surtain',
    position: 'CB',
    contractYearsRemaining: 2,
    capHit: '$7.1M',
    status: 'Active',
    headshotUrl: null,
    year1CapHit: 7.1,
  },
  {
    id: 'p5',
    firstName: 'Penei',
    lastName: 'Sewell',
    position: 'OL',
    contractYearsRemaining: 3,
    capHit: '$6.2M',
    status: 'Active',
    headshotUrl: null,
    year1CapHit: 6.2,
  },
];

const PICK_VALUES: Record<string, { label: string; value: number }> = {
  '2025-r1': { label: '2025 Round 1 Pick', value: 95 },
  '2025-r2': { label: '2025 Round 2 Pick', value: 70 },
  '2025-r3': { label: '2025 Round 3 Pick', value: 50 },
  '2025-r4': { label: '2025 Round 4 Pick', value: 30 },
  '2025-r5': { label: '2025 Round 5 Pick', value: 20 },
  '2025-r6': { label: '2025 Round 6 Pick', value: 10 },
  '2025-r7': { label: '2025 Round 7 Pick', value: 5 },
};

const clonePartnerRoster = (teamAbbr: string) =>
  BASE_PARTNER_PLAYERS.map((player, index) => ({
    ...player,
    id: `${teamAbbr}-${index + 1}`,
  }));

const getPartnerRoster = (teamAbbr: string): StoredTradePlayer[] => {
  if (!partnerRosterStore.has(teamAbbr)) {
    partnerRosterStore.set(teamAbbr, clonePartnerRoster(teamAbbr));
  }

  return partnerRosterStore.get(teamAbbr) ?? [];
};

const toPlayerDTO = (player: StoredTradePlayer): PlayerRowDTO => ({
  id: player.id,
  firstName: player.firstName,
  lastName: player.lastName,
  position: player.position,
  contractYearsRemaining: player.contractYearsRemaining,
  capHit: player.capHit,
  status: player.status,
  headshotUrl: player.headshotUrl ?? null,
  signedTeamAbbr: player.signedTeamAbbr ?? null,
  signedTeamLogoUrl: player.signedTeamLogoUrl ?? null,
});

const getPlayerValue = (capHit: string): number =>
  Math.round(parseMoneyMillions(capHit) * 10);

const buildPlayerAsset = (
  player: PlayerRowDTO,
  side: TradeSide,
): TradeAssetDTO => ({
  id: `asset-${side}-player-${player.id}`,
  type: 'player',
  side,
  label: `${player.firstName} ${player.lastName} (${player.position})`,
  value: getPlayerValue(player.capHit),
  playerId: player.id,
});

const buildPickAsset = (pickId: string, side: TradeSide): TradeAssetDTO => {
  const pick = PICK_VALUES[pickId];
  if (!pick) {
    throw new Error('Pick not found');
  }

  return {
    id: `asset-${side}-pick-${pickId}`,
    type: 'pick',
    side,
    label: pick.label,
    value: pick.value,
    pickId,
  };
};

const findPlayer = (players: PlayerRowDTO[], playerId: string) =>
  players.find((player) => player.id === playerId);

const cloneTrade = (trade: TradeDTO): TradeDTO => ({
  ...trade,
  sendAssets: [...trade.sendAssets],
  receiveAssets: [...trade.receiveAssets],
});

export const createTrade = (
  saveId: string,
  partnerTeamAbbr: string,
  playerId?: string,
): SaveResult<TradeRosterResponse> => {
  const stateResult = getSaveStateResult(saveId);
  if (!stateResult.ok) {
    return stateResult;
  }

  const tradeId = `trade_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  const trade: TradeDTO = {
    id: tradeId,
    saveId,
    partnerTeamAbbr,
    sendAssets: [],
    receiveAssets: [],
  };

  if (playerId) {
    const player = findPlayer(stateResult.data.roster, playerId);
    if (player) {
      trade.sendAssets.push(buildPlayerAsset(player, 'send'));
    }
  }

  tradeStore.set(tradeId, { trade });

  return {
    ok: true,
    data: {
      trade: cloneTrade(trade),
      userRoster: stateResult.data.roster.map((player) => toPlayerDTO(player)),
      partnerRoster: getPartnerRoster(partnerTeamAbbr).map((player) =>
        toPlayerDTO(player),
      ),
    },
  };
};

export const addTradeAsset = (
  tradeId: string,
  payload: {
    side: TradeSide;
    type: 'player' | 'pick';
    playerId?: string;
    pickId?: string;
  },
  saveId?: string,
): SaveResult<TradeDTO> => {
  const state = tradeStore.get(tradeId);
  if (!state) {
    throw new Error('Trade not found');
  }

  const trade = state.trade;
  if (saveId && trade.saveId !== saveId) {
    return { ok: false, error: 'Save not found' };
  }
  const assets = payload.side === 'send' ? trade.sendAssets : trade.receiveAssets;

  if (payload.type === 'player') {
    if (!payload.playerId) {
      throw new Error('playerId is required');
    }
    if (assets.some((asset) => asset.playerId === payload.playerId)) {
      return { ok: true, data: cloneTrade(trade) };
    }

    if (payload.side === 'send') {
      const saveStateResult = getSaveStateResult(trade.saveId);
      if (!saveStateResult.ok) {
        return saveStateResult;
      }
      const player = findPlayer(saveStateResult.data.roster, payload.playerId);
      if (!player) {
        throw new Error('Player not found');
      }
      assets.push(buildPlayerAsset(player, payload.side));
    } else {
      const partnerRoster = getPartnerRoster(trade.partnerTeamAbbr);
      const player = findPlayer(partnerRoster, payload.playerId);
      if (!player) {
        throw new Error('Player not found');
      }
      assets.push(buildPlayerAsset(player, payload.side));
    }
  } else {
    if (!payload.pickId) {
      throw new Error('pickId is required');
    }
    if (assets.some((asset) => asset.pickId === payload.pickId)) {
      return { ok: true, data: cloneTrade(trade) };
    }
    assets.push(buildPickAsset(payload.pickId, payload.side));
  }

  return { ok: true, data: cloneTrade(trade) };
};

const sumValues = (assets: TradeAssetDTO[]) =>
  assets.reduce((total, asset) => total + asset.value, 0);

export const proposeTrade = (
  tradeId: string,
  saveId?: string,
): SaveResult<{
  trade: TradeDTO;
  acceptance: number;
  accepted: boolean;
  header: SaveHeaderDTO;
}> => {
  const storedTrade = tradeStore.get(tradeId);
  if (!storedTrade) {
    throw new Error('Trade not found');
  }

  const trade = storedTrade.trade;
  if (saveId && trade.saveId !== saveId) {
    return { ok: false, error: 'Save not found' };
  }
  const sendValue = sumValues(trade.sendAssets);
  const receiveValue = sumValues(trade.receiveAssets);
  const acceptance = sendValue === 0 ? 0 : Math.min(100, Math.round((receiveValue / sendValue) * 100));
  const accepted = acceptance >= 70;

  const saveStateResult = getSaveStateResult(trade.saveId);
  if (!saveStateResult.ok) {
    return saveStateResult;
  }

  if (accepted) {
    const partnerRoster = getPartnerRoster(trade.partnerTeamAbbr);
    trade.sendAssets
      .filter((asset) => asset.type === 'player' && asset.playerId)
      .forEach((asset) => {
        const playerIndex = saveStateResult.data.roster.findIndex(
          (player) => player.id === asset.playerId,
        );
        if (playerIndex === -1) {
          return;
        }

        const [player] = saveStateResult.data.roster.splice(playerIndex, 1);
        partnerRoster.push({
          ...player,
          year1CapHit: parseMoneyMillions(player.capHit),
        });
        saveStateResult.data.header.capSpace = Number(
          (saveStateResult.data.header.capSpace + parseMoneyMillions(player.capHit)).toFixed(1),
        );
      });

    saveStateResult.data.header.rosterCount = saveStateResult.data.roster.length;
  }

  return {
    ok: true,
    data: {
      trade: cloneTrade(trade),
      acceptance,
      accepted,
      header: getSaveHeaderSnapshot(saveStateResult.data),
    },
  };
};
