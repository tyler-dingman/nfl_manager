import type { SaveResult } from '@/server/api/store';
import { getSaveStateResult } from '@/server/api/store';
import { buildTradeBlock } from '@/server/logic/trade-block';
import type { TradeBlockRow } from '@/types/trade-block';

export const getTradeBlock = (
  saveId: string,
  teamAbbr?: string | null,
): SaveResult<TradeBlockRow[]> => {
  const stateResult = getSaveStateResult(saveId);
  if (!stateResult.ok) {
    return stateResult;
  }

  return {
    ok: true,
    data: buildTradeBlock(stateResult.data, teamAbbr),
  };
};
