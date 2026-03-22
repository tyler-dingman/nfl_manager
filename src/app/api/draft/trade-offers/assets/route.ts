import { NextResponse } from 'next/server';

import { ensureDraftTradeContext, getDraftTradeAssetSource } from '@/server/api/draft-trade';
import { toPlayerDTO } from '@/server/api/trades';
import type { DraftSessionDTO } from '@/types/draft';
import type { PlayerRowDTO } from '@/types/player';
import type { SaveUnlocksDTO } from '@/types/save';
import type { TeamTradeAssetSourceDTO } from '@/types/trade-offers';

type DraftTradeOfferAssetsBody = {
  saveId?: string;
  draftSessionId?: string;
  partnerTeamAbbr?: string;
  sessionSnapshot?: DraftSessionDTO;
  saveSnapshot?: {
    teamAbbr: string;
    capSpace: number;
    capLimit: number;
    roster: PlayerRowDTO[];
    phase?: string;
    unlocked?: SaveUnlocksDTO;
    createdAt?: string;
  };
};

export const POST = async (request: Request) => {
  const body = (await request.json()) as DraftTradeOfferAssetsBody;
  if (!body.saveId || !body.draftSessionId || !body.partnerTeamAbbr) {
    return NextResponse.json(
      { ok: false, error: 'Missing draft trade asset inputs.' },
      { status: 400 },
    );
  }

  try {
    const { state, session } = ensureDraftTradeContext({
      saveId: body.saveId,
      draftSessionId: body.draftSessionId,
      sessionSnapshot: body.sessionSnapshot,
      saveSnapshot: body.saveSnapshot,
    });

    const userTeamAbbr = session.userTeamAbbr.toUpperCase();
    const partnerTeamAbbr = body.partnerTeamAbbr.toUpperCase();
    const buildSource = (teamAbbr: string): TeamTradeAssetSourceDTO => {
      const source = getDraftTradeAssetSource(state, session, teamAbbr);
      return {
        teamAbbr,
        players: source.players.map((player) => toPlayerDTO(player)),
        draftPicks: source.draftPicks,
      };
    };

    return NextResponse.json({
      ok: true,
      user: buildSource(userTeamAbbr),
      partner: buildSource(partnerTeamAbbr),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to load draft trade assets.';
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
};
