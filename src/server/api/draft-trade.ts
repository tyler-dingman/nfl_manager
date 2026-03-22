import { buildPickAsset } from '@/lib/trade-chart';
import { CURRENT_MODELED_LEAGUE_YEAR } from '@/server/logic/contract-expiration';
import { findSaveIdForDraftSession, restoreDraftSession } from '@/server/api/draft';
import {
  getDraftPickAssetById,
  getSaveStateResult,
  getTeamTradeAssets,
  type SaveState,
} from '@/server/api/store';
import type { DraftPickDTO, DraftSessionDTO } from '@/types/draft';
import type { PlayerRowDTO } from '@/types/player';
import type { SaveUnlocksDTO } from '@/types/save';
import type { TradePickAssetDTO } from '@/types/trade-offers';

type DraftSaveSnapshot = {
  teamAbbr: string;
  capSpace: number;
  capLimit: number;
  roster: PlayerRowDTO[];
  phase?: string;
  unlocked?: SaveUnlocksDTO;
  createdAt?: string;
};

type DraftTradeContextInput = {
  saveId: string;
  draftSessionId: string;
  sessionSnapshot?: DraftSessionDTO;
  saveSnapshot?: DraftSaveSnapshot;
};

const sortTradePicks = (picks: TradePickAssetDTO[]) =>
  picks.slice().sort((left, right) => {
    if (left.year !== right.year) return left.year - right.year;
    if (left.round !== right.round) return left.round - right.round;
    if ((left.overallSlot ?? 999) !== (right.overallSlot ?? 999)) {
      return (left.overallSlot ?? 999) - (right.overallSlot ?? 999);
    }
    return left.originalTeamAbbr.localeCompare(right.originalTeamAbbr);
  });

const buildLiveSessionPickAsset = (pick: DraftPickDTO): TradePickAssetDTO =>
  buildPickAsset({
    year: CURRENT_MODELED_LEAGUE_YEAR,
    round: pick.round,
    overallSlot: pick.overall,
    owningTeamAbbr: pick.ownerTeamAbbr,
    originalTeamAbbr: pick.originalTeamAbbr,
  });

export const ensureDraftTradeContext = ({
  saveId,
  draftSessionId,
  sessionSnapshot,
  saveSnapshot,
}: DraftTradeContextInput): {
  resolvedSaveId: string;
  state: SaveState;
  session: DraftSessionDTO;
} => {
  const tryLoad = (candidateSaveId: string | null) => {
    if (!candidateSaveId) return null;
    const result = getSaveStateResult(candidateSaveId);
    if (!result.ok) return null;
    const session = result.data.draftSessions[draftSessionId];
    if (!session) return null;
    return { resolvedSaveId: candidateSaveId, state: result.data, session };
  };

  const current = tryLoad(saveId);
  if (current) {
    return current;
  }

  const discovered = tryLoad(findSaveIdForDraftSession(draftSessionId));
  if (discovered) {
    return discovered;
  }

  if (!sessionSnapshot) {
    throw new Error('Draft session not found');
  }

  restoreDraftSession(saveId, sessionSnapshot, saveSnapshot);
  const restored = tryLoad(saveId);
  if (!restored) {
    throw new Error('Unable to restore draft trade session');
  }
  return restored;
};

export const getDraftTradeAssetSource = (
  state: SaveState,
  session: DraftSessionDTO,
  teamAbbr: string,
) => {
  const normalizedTeamAbbr = teamAbbr.toUpperCase();
  const saveAssets = getTeamTradeAssets(state, normalizedTeamAbbr);
  const liveCurrentYearPicks = session.picks
    .filter(
      (pick) =>
        pick.ownerTeamAbbr === normalizedTeamAbbr && !pick.selectedPlayerId && pick.round >= 1,
    )
    .map(buildLiveSessionPickAsset);
  const futurePicks = saveAssets.draftPicks.filter(
    (pick) => pick.year !== CURRENT_MODELED_LEAGUE_YEAR,
  );

  return {
    players: saveAssets.players,
    draftPicks: sortTradePicks([...liveCurrentYearPicks, ...futurePicks]),
  };
};

export const resolveDraftTradePickAssetById = (
  state: SaveState,
  session: DraftSessionDTO,
  pickId: string,
): TradePickAssetDTO | null => {
  const livePick = session.picks
    .filter((pick) => !pick.selectedPlayerId)
    .map(buildLiveSessionPickAsset)
    .find((pick) => pick.id === pickId);
  if (livePick) {
    return livePick;
  }
  return getDraftPickAssetById(state, pickId);
};
