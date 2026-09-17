import { NextResponse } from 'next/server';

import {
  getProjectedCapSpaceForTeam,
  getTeamTradeAssets,
  getSaveStateResult,
} from '@/server/api/store';
import { toPlayerDTO } from '@/server/api/trades';
import { computeTeamNeeds } from '@/lib/team-overview';
import type { TeamTradeAssetSourceDTO } from '@/types/trade-offers';

type TradeOfferAssetsBody = {
  saveId?: string;
  partnerTeamAbbr?: string;
};

export const POST = async (request: Request) => {
  const body = (await request.json()) as TradeOfferAssetsBody;
  if (!body.saveId || !body.partnerTeamAbbr) {
    return NextResponse.json(
      { ok: false, error: 'Missing trade offer asset inputs.' },
      { status: 400 },
    );
  }

  const saveResult = getSaveStateResult(body.saveId);
  if (!saveResult.ok) {
    return NextResponse.json({ ok: false, error: saveResult.error }, { status: 404 });
  }

  const userTeamAbbr = saveResult.data.header.teamAbbr.toUpperCase();
  const partnerTeamAbbr = body.partnerTeamAbbr.toUpperCase();
  const buildAssetSource = (teamAbbr: string): TeamTradeAssetSourceDTO => {
    const assets = getTeamTradeAssets(saveResult.data, teamAbbr);
    return {
      teamAbbr,
      players: assets.players.map((player) => toPlayerDTO(player)),
      draftPicks: assets.draftPicks,
    };
  };

  return NextResponse.json({
    ok: true,
    user: buildAssetSource(userTeamAbbr),
    partner: buildAssetSource(partnerTeamAbbr),
    caps: {
      user: getProjectedCapSpaceForTeam(saveResult.data, userTeamAbbr),
      partner: getProjectedCapSpaceForTeam(saveResult.data, partnerTeamAbbr),
    },
    needs: {
      user: computeTeamNeeds(getTeamTradeAssets(saveResult.data, userTeamAbbr).players, 5),
      partner: computeTeamNeeds(getTeamTradeAssets(saveResult.data, partnerTeamAbbr).players, 5),
    },
  });
};
