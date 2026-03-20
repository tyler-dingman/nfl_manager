import type { PlayerRowDTO } from '@/types/player';
import type { SaveHeaderDTO } from '@/types/save';

import {
  getProjectedCapSpaceForTeam,
  getOrBuildProjectedRosterForTeam,
  getProjectedRosterForTeam,
  getSaveHeaderSnapshot,
  getSaveStateResult,
  pushNewsItem,
  transferStoredPlayerToTeam,
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

type TradeValidationErrorCode =
  | 'INVALID_PLAYER_OWNERSHIP'
  | 'DUPLICATE_PLAYERS'
  | 'CAP_VIOLATION'
  | 'INVALID_ROSTER_STATE';

type TradeValidationError = {
  code: TradeValidationErrorCode;
  message: string;
  teamAbbr?: string;
  playerId?: string;
};

export type TradeProposal = {
  sendingTeamId: string;
  receivingTeamId: string;
  outgoingPlayers: PlayerRowDTO[];
  incomingPlayers: PlayerRowDTO[];
  capImpact: TradeSimulationResult;
  valueScore: number;
  isValid: boolean;
  validationErrors: TradeValidationError[];
};

type TeamCapImpact = {
  teamAbbr: string;
  capDelta: number;
  resultingCapSpace: number;
  deadCap: number;
  savings: number;
};

type TradeSimulationResult = {
  teams: {
    sending: TeamCapImpact;
    receiving: TeamCapImpact;
  };
  warnings: string[];
};

type TradeBalanceResult = {
  outgoingValue: number;
  incomingValue: number;
  difference: number;
  balanced: boolean;
  explanation: string;
};

const tradeStore = new Map<string, TradeState>();

const PICK_VALUES: Record<string, { label: string; value: number }> = {
  '2025-r1': { label: '2025 Round 1 Pick', value: 95 },
  '2025-r2': { label: '2025 Round 2 Pick', value: 70 },
  '2025-r3': { label: '2025 Round 3 Pick', value: 50 },
  '2025-r4': { label: '2025 Round 4 Pick', value: 30 },
  '2025-r5': { label: '2025 Round 5 Pick', value: 20 },
  '2025-r6': { label: '2025 Round 6 Pick', value: 10 },
  '2025-r7': { label: '2025 Round 7 Pick', value: 5 },
};

const getPartnerRoster = (
  state: Parameters<typeof getOrBuildProjectedRosterForTeam>[0],
  teamAbbr: string,
): StoredTradePlayer[] => {
  return getOrBuildProjectedRosterForTeam(state, teamAbbr);
};

export const toPlayerDTO = (player: StoredTradePlayer): PlayerRowDTO => ({
  id: player.id,
  firstName: player.firstName,
  lastName: player.lastName,
  teamAbbr: player.teamAbbr ?? null,
  normalizedName: player.normalizedName,
  position: player.position,
  age: player.age,
  height: player.height ?? null,
  weight: player.weight ?? null,
  baselineRating: player.baselineRating ?? null,
  maddenRating: player.maddenRating ?? null,
  rating: player.rating,
  stats: player.stats ?? {},
  contractYearsRemaining: player.contractYearsRemaining,
  capHit: player.capHit,
  capHitValue: player.capHitValue,
  salary: player.salary,
  guaranteed: player.guaranteed,
  deadCap: player.deadCap,
  status: player.status,
  headshotUrl: player.headshotUrl ?? null,
  lastTeamAbbr: player.lastTeamAbbr ?? null,
  currentTeamAbbr: player.currentTeamAbbr ?? null,
  contractStatus: player.contractStatus ?? null,
  isUnsigned: player.isUnsigned,
  averagePerYear: player.averagePerYear ?? null,
  signedTeamAbbr: player.signedTeamAbbr ?? null,
  signedTeamLogoUrl: player.signedTeamLogoUrl ?? null,
  contract: player.contract,
});

const getPlayerValue = (capHit: string): number => Math.round(parseMoneyMillions(capHit) * 10);

const buildPlayerAsset = (player: PlayerRowDTO, side: TradeSide): TradeAssetDTO => ({
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

const getCapHit = (player: PlayerRowDTO) => parseMoneyMillions(player.capHit);

export const evaluatePlayerValue = (
  player: PlayerRowDTO,
): { valueScore: number; contractBurdenModifier: number } => {
  const age = player.age ?? 27;
  const capHit = getCapHit(player);
  const yearsRemaining = Math.max(1, player.contractYearsRemaining);
  const guaranteed = player.guaranteed ?? player.contract?.guaranteed ?? 0;
  const positionWeight: Record<string, number> = {
    QB: 1.3,
    WR: 1.15,
    EDGE: 1.15,
    OT: 1.12,
    CB: 1.1,
    LB: 1.0,
    S: 0.98,
    TE: 0.97,
    OL: 1.0,
    DL: 1.02,
    RB: 0.85,
    K: 0.5,
    P: 0.45,
  };

  const ageFactor = Math.max(0.7, Math.min(1.2, 1.1 - Math.max(0, age - 26) * 0.015));
  const contractCostPenalty = Math.max(0.6, 1 - capHit * 0.02);
  const guaranteePenalty = Math.max(0.65, 1 - guaranteed * 0.01);
  const termPenalty = Math.max(0.7, 1 - (yearsRemaining - 1) * 0.06);
  const positionFactor = positionWeight[player.position] ?? 1;

  const contractBurdenModifier = Number(
    (contractCostPenalty * guaranteePenalty * termPenalty).toFixed(3),
  );
  const baseTalentScore = 70 * ageFactor * positionFactor;
  const valueScore = Number((baseTalentScore * contractBurdenModifier).toFixed(1));

  return { valueScore, contractBurdenModifier };
};

const computeTeamCapImpact = (
  teamAbbr: string,
  baseCapSpace: number,
  outgoingPlayers: PlayerRowDTO[],
  incomingPlayers: PlayerRowDTO[],
): TeamCapImpact => {
  const outgoingCap = outgoingPlayers.reduce((sum, player) => sum + getCapHit(player), 0);
  const incomingCap = incomingPlayers.reduce((sum, player) => sum + getCapHit(player), 0);
  const outgoingDeadCap = outgoingPlayers.reduce((sum, player) => sum + (player.deadCap ?? 0), 0);
  const savings = Number(Math.max(0, outgoingCap - outgoingDeadCap).toFixed(1));
  const capDelta = Number((outgoingCap - incomingCap).toFixed(1));
  const resultingCapSpace = Number((baseCapSpace + capDelta).toFixed(1));

  return {
    teamAbbr,
    capDelta,
    resultingCapSpace,
    deadCap: Number(outgoingDeadCap.toFixed(1)),
    savings,
  };
};

export const simulateTrade = (
  tradeProposal: Omit<TradeProposal, 'capImpact' | 'isValid' | 'validationErrors'> & {
    sendingBaseCapSpace: number;
    receivingBaseCapSpace: number;
  },
): TradeSimulationResult => {
  const sending = computeTeamCapImpact(
    tradeProposal.sendingTeamId,
    tradeProposal.sendingBaseCapSpace,
    tradeProposal.outgoingPlayers,
    tradeProposal.incomingPlayers,
  );
  const receiving = computeTeamCapImpact(
    tradeProposal.receivingTeamId,
    tradeProposal.receivingBaseCapSpace,
    tradeProposal.incomingPlayers,
    tradeProposal.outgoingPlayers,
  );

  const warnings: string[] = [];
  if (sending.resultingCapSpace < 5) {
    warnings.push(`${sending.teamAbbr} would have less than $5.0M cap space remaining.`);
  }
  if (receiving.resultingCapSpace < 5) {
    warnings.push(`${receiving.teamAbbr} would have less than $5.0M cap space remaining.`);
  }

  return { teams: { sending, receiving }, warnings };
};

const evaluateTradeBalance = (
  outgoingPlayers: PlayerRowDTO[],
  incomingPlayers: PlayerRowDTO[],
): TradeBalanceResult => {
  const outgoingValue = Number(
    outgoingPlayers
      .reduce((sum, player) => sum + evaluatePlayerValue(player).valueScore, 0)
      .toFixed(1),
  );
  const incomingValue = Number(
    incomingPlayers
      .reduce((sum, player) => sum + evaluatePlayerValue(player).valueScore, 0)
      .toFixed(1),
  );
  const difference = Number((incomingValue - outgoingValue).toFixed(1));
  const balanced = Math.abs(difference) <= 15;

  return {
    outgoingValue,
    incomingValue,
    difference,
    balanced,
    explanation: balanced
      ? 'Trade value is balanced for both teams.'
      : difference > 0
        ? 'Receiving team gains significantly more value.'
        : 'Sending team gains significantly more value.',
  };
};

export const validateTrade = (
  tradeProposal: Omit<TradeProposal, 'isValid' | 'validationErrors'>,
  userRoster: PlayerRowDTO[],
  partnerRoster: PlayerRowDTO[],
): { isValid: boolean; validationErrors: TradeValidationError[] } => {
  const errors: TradeValidationError[] = [];
  const outgoingIds = tradeProposal.outgoingPlayers.map((player) => player.id);
  const incomingIds = tradeProposal.incomingPlayers.map((player) => player.id);

  const duplicateIds = new Set<string>();
  [...outgoingIds, ...incomingIds].forEach((id, _, all) => {
    if (all.indexOf(id) !== all.lastIndexOf(id)) {
      duplicateIds.add(id);
    }
  });

  duplicateIds.forEach((playerId) => {
    errors.push({
      code: 'DUPLICATE_PLAYERS',
      message: 'Player cannot be included more than once in a trade.',
      playerId,
    });
  });

  outgoingIds.forEach((playerId) => {
    if (!userRoster.some((player) => player.id === playerId)) {
      errors.push({
        code: 'INVALID_PLAYER_OWNERSHIP',
        message: 'Outgoing player does not belong to sending team.',
        teamAbbr: tradeProposal.sendingTeamId,
        playerId,
      });
    }
  });

  incomingIds.forEach((playerId) => {
    if (!partnerRoster.some((player) => player.id === playerId)) {
      errors.push({
        code: 'INVALID_PLAYER_OWNERSHIP',
        message: 'Incoming player does not belong to receiving team.',
        teamAbbr: tradeProposal.receivingTeamId,
        playerId,
      });
    }
  });

  if (tradeProposal.capImpact.teams.sending.resultingCapSpace < 0) {
    errors.push({
      code: 'CAP_VIOLATION',
      message: `${tradeProposal.sendingTeamId} exceeds cap after this trade.`,
      teamAbbr: tradeProposal.sendingTeamId,
    });
  }
  if (tradeProposal.capImpact.teams.receiving.resultingCapSpace < 0) {
    errors.push({
      code: 'CAP_VIOLATION',
      message: `${tradeProposal.receivingTeamId} exceeds cap after this trade.`,
      teamAbbr: tradeProposal.receivingTeamId,
    });
  }

  const resultingUserIds = new Set(userRoster.map((player) => player.id));
  outgoingIds.forEach((id) => resultingUserIds.delete(id));
  incomingIds.forEach((id) => resultingUserIds.add(id));

  const resultingPartnerIds = new Set(partnerRoster.map((player) => player.id));
  incomingIds.forEach((id) => resultingPartnerIds.delete(id));
  outgoingIds.forEach((id) => resultingPartnerIds.add(id));

  for (const id of resultingUserIds) {
    if (resultingPartnerIds.has(id)) {
      errors.push({
        code: 'INVALID_ROSTER_STATE',
        message: 'Player cannot exist on both teams after the trade.',
        playerId: id,
      });
    }
  }

  return { isValid: errors.length === 0, validationErrors: errors };
};

const buildTradeProposal = (
  trade: TradeDTO,
  userTeamAbbr: string,
  userRoster: PlayerRowDTO[],
  partnerRoster: PlayerRowDTO[],
  userCap: number,
  partnerCap: number,
) => {
  const outgoingPlayers = trade.sendAssets
    .filter((asset) => asset.type === 'player' && asset.playerId)
    .map((asset) => findPlayer(userRoster, asset.playerId as string))
    .filter((player): player is PlayerRowDTO => Boolean(player));

  const incomingPlayers = trade.receiveAssets
    .filter((asset) => asset.type === 'player' && asset.playerId)
    .map((asset) => findPlayer(partnerRoster, asset.playerId as string))
    .filter((player): player is PlayerRowDTO => Boolean(player));

  const value = evaluateTradeBalance(outgoingPlayers, incomingPlayers);
  const capImpact = simulateTrade({
    sendingTeamId: userTeamAbbr,
    receivingTeamId: trade.partnerTeamAbbr.toUpperCase(),
    outgoingPlayers,
    incomingPlayers,
    valueScore: value.difference,
    sendingBaseCapSpace: userCap,
    receivingBaseCapSpace: partnerCap,
  });

  const proposalBase = {
    sendingTeamId: userTeamAbbr,
    receivingTeamId: trade.partnerTeamAbbr.toUpperCase(),
    outgoingPlayers,
    incomingPlayers,
    capImpact,
    valueScore: value.difference,
  };

  const validation = validateTrade(proposalBase, userRoster, partnerRoster);

  const proposal: TradeProposal = {
    ...proposalBase,
    isValid: validation.isValid,
    validationErrors: validation.validationErrors,
  };

  return { proposal, value };
};

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
    const player = findPlayer(getPartnerRoster(stateResult.data, partnerTeamAbbr), playerId);
    if (player) {
      trade.receiveAssets.push(buildPlayerAsset(player, 'receive'));
    }
  }

  tradeStore.set(tradeId, { trade });

  return {
    ok: true,
    data: {
      trade: cloneTrade(trade),
      userRoster: getProjectedRosterForTeam(stateResult.data, stateResult.data.header.teamAbbr).map(
        (player) => toPlayerDTO(player),
      ),
      partnerRoster: getPartnerRoster(stateResult.data, partnerTeamAbbr).map((player) =>
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
      const saveStateResult = getSaveStateResult(trade.saveId);
      if (!saveStateResult.ok) {
        return saveStateResult;
      }
      const partnerRoster = getPartnerRoster(saveStateResult.data, trade.partnerTeamAbbr);
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

export const removeTradeAsset = (
  tradeId: string,
  payload: {
    side: TradeSide;
    assetId?: string;
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
  const index = assets.findIndex((asset) => {
    if (payload.assetId && asset.id === payload.assetId) return true;
    if (payload.playerId && asset.playerId === payload.playerId) return true;
    if (payload.pickId && asset.pickId === payload.pickId) return true;
    return false;
  });

  if (index !== -1) {
    assets.splice(index, 1);
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
  caps: {
    userTeamAbbr: string;
    userCapSpace: number;
    partnerTeamAbbr: string;
    partnerCapSpace: number;
  };
  simulation: TradeSimulationResult;
  tradeBalance: TradeBalanceResult;
  proposal: TradeProposal;
}> => {
  const storedTrade = tradeStore.get(tradeId);
  if (!storedTrade) {
    throw new Error('Trade not found');
  }

  const trade = storedTrade.trade;
  if (saveId && trade.saveId !== saveId) {
    return { ok: false, error: 'Save not found' };
  }

  const saveStateResult = getSaveStateResult(trade.saveId);
  if (!saveStateResult.ok) {
    return saveStateResult;
  }

  const userTeamAbbr = saveStateResult.data.header.teamAbbr.toUpperCase();
  const partnerTeamAbbr = trade.partnerTeamAbbr.toUpperCase();
  const userRoster = getProjectedRosterForTeam(saveStateResult.data, userTeamAbbr);
  const partnerRoster = getPartnerRoster(saveStateResult.data, partnerTeamAbbr);
  const userCap = getProjectedCapSpaceForTeam(saveStateResult.data, userTeamAbbr);
  const partnerCap = getProjectedCapSpaceForTeam(saveStateResult.data, partnerTeamAbbr);

  const { proposal, value } = buildTradeProposal(
    trade,
    userTeamAbbr,
    userRoster,
    partnerRoster,
    userCap,
    partnerCap,
  );
  const sendValue = sumValues(trade.sendAssets);
  const receiveValue = sumValues(trade.receiveAssets);
  const acceptance =
    sendValue === 0 ? 0 : Math.min(100, Math.round((receiveValue / sendValue) * 100));
  const accepted = acceptance >= 70 && proposal.isValid;

  if (accepted) {
    const sendPlayerIds = new Set(proposal.outgoingPlayers.map((player) => player.id));
    const receivePlayerIds = new Set(proposal.incomingPlayers.map((player) => player.id));

    const sentPlayers = userRoster.filter((player) => sendPlayerIds.has(player.id));
    const receivedPlayers = partnerRoster.filter((player) => receivePlayerIds.has(player.id));

    saveStateResult.data.teamRosters[userTeamAbbr] = userRoster
      .filter((player) => !sendPlayerIds.has(player.id))
      .concat(receivedPlayers.map((player) => transferStoredPlayerToTeam(player, userTeamAbbr)));
    saveStateResult.data.teamRosters[partnerTeamAbbr] = partnerRoster
      .filter((player) => !receivePlayerIds.has(player.id))
      .concat(sentPlayers.map((player) => transferStoredPlayerToTeam(player, partnerTeamAbbr)));

    saveStateResult.data.roster = saveStateResult.data.teamRosters[userTeamAbbr];
    saveStateResult.data.header.rosterCount = saveStateResult.data.roster.length;
    saveStateResult.data.header.capSpace = proposal.capImpact.teams.sending.resultingCapSpace;
    saveStateResult.data.teamCaps[userTeamAbbr] =
      proposal.capImpact.teams.sending.resultingCapSpace;
    saveStateResult.data.teamCaps[partnerTeamAbbr] =
      proposal.capImpact.teams.receiving.resultingCapSpace;

    const now = new Date().toISOString();
    for (const player of sentPlayers) {
      saveStateResult.data.transactions.push({
        id: `tx_trade_${Date.now()}_${Math.random().toString(16).slice(2)}`,
        type: 'trade',
        playerId: player.id,
        fromTeamAbbr: userTeamAbbr,
        toTeamAbbr: partnerTeamAbbr,
        capHit: parseMoneyMillions(player.capHit),
        createdAt: now,
      });
      saveStateResult.data.rosterMoves.trades.push({
        playerId: player.id,
        name: `${player.firstName} ${player.lastName}`,
        timestamp: now,
      });
    }
    for (const player of receivedPlayers) {
      saveStateResult.data.transactions.push({
        id: `tx_trade_${Date.now()}_${Math.random().toString(16).slice(2)}`,
        type: 'trade',
        playerId: player.id,
        fromTeamAbbr: partnerTeamAbbr,
        toTeamAbbr: userTeamAbbr,
        capHit: parseMoneyMillions(player.capHit),
        createdAt: now,
      });
      saveStateResult.data.rosterMoves.trades.push({
        playerId: player.id,
        name: `${player.firstName} ${player.lastName}`,
        timestamp: now,
      });
    }

    pushNewsItem(saveStateResult.data, {
      type: 'trade',
      teamAbbr: saveStateResult.data.header.teamAbbr,
      playerName: '',
      details: `${saveStateResult.data.header.teamAbbr} complete a trade with ${trade.partnerTeamAbbr}.`,
      severity: 'info',
    });
  }

  return {
    ok: true,
    data: {
      trade: cloneTrade(trade),
      acceptance,
      accepted,
      header: getSaveHeaderSnapshot(saveStateResult.data),
      caps: {
        userTeamAbbr,
        userCapSpace: getProjectedCapSpaceForTeam(saveStateResult.data, userTeamAbbr),
        partnerTeamAbbr,
        partnerCapSpace: getProjectedCapSpaceForTeam(saveStateResult.data, partnerTeamAbbr),
      },
      simulation: proposal.capImpact,
      tradeBalance: value,
      proposal,
    },
  };
};
