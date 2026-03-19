import { NextResponse } from 'next/server';

import { buildPickAsset } from '@/lib/trade-chart';
import { gradeTradeOffer } from '@/lib/trade-offer-evaluator';
import { buildTradePlayerAsset } from '@/lib/trade-player-valuation';
import { getSaveStateResult } from '@/server/api/store';
import {
  buildEvaluationContext,
  buildTeamContexts,
} from '@/server/logic/trade-offer-generator';
import type { PlayerRowDTO } from '@/types/player';
import type { TradeOfferDTO } from '@/types/trade-offers';

type EvaluateTradeOfferBody = {
  saveId?: string;
  offer?: TradeOfferDTO;
  extraPlayerIds?: string[];
  extraPickIds?: string[];
};

const buildPickFromId = (pickId: string, teamAbbr: string) => {
  const [yearToken, roundToken, overallToken] = pickId.split(':');
  const year = Number(yearToken);
  const round = Number(roundToken?.replace(/^r/i, ''));
  const overallSlot = overallToken ? Number(overallToken) : null;

  if (!Number.isFinite(year) || !Number.isFinite(round)) {
    throw new Error('Invalid pick id');
  }

  return buildPickAsset({
    year,
    round,
    overallSlot,
    owningTeamAbbr: teamAbbr,
  });
};

export const POST = async (request: Request) => {
  const body = (await request.json()) as EvaluateTradeOfferBody;
  if (!body.saveId || !body.offer) {
    return NextResponse.json({ ok: false, error: 'Missing trade offer evaluation inputs.' }, { status: 400 });
  }

  const saveResult = getSaveStateResult(body.saveId);
  if (!saveResult.ok) {
    return NextResponse.json({ ok: false, error: saveResult.error }, { status: 404 });
  }

  const state = saveResult.data;
  const contexts = buildTeamContexts(state);
  const userTeam = contexts.get(state.header.teamAbbr.toUpperCase());
  const aiTeam = contexts.get(body.offer.proposingTeamAbbr.toUpperCase());
  if (!userTeam || !aiTeam) {
    return NextResponse.json({ ok: false, error: 'Unable to resolve trade offer teams.' }, { status: 400 });
  }

  const extraPlayers = (body.extraPlayerIds ?? [])
    .map((playerId) => userTeam.roster.find((player) => player.id === playerId))
    .filter((player): player is PlayerRowDTO => Boolean(player))
    .slice(0, 2)
    .map((player) => buildTradePlayerAsset(player, buildEvaluationContext(body.offer!.phase, aiTeam.team.abbr, aiTeam)));

  const extraPicks = (body.extraPickIds ?? [])
    .slice(0, 2)
    .map((pickId) => buildPickFromId(pickId, userTeam.team.abbr));

  const outgoingAssets = [...body.offer.outgoing.assets, ...extraPlayers, ...extraPicks];
  const incomingAssets = body.offer.incoming.assets;

  const graded = gradeTradeOffer(
    {
      assets: incomingAssets,
      totalValue: incomingAssets.reduce((sum, asset) => sum + asset.projectedValuePoints, 0),
    },
    {
      assets: outgoingAssets,
      totalValue: outgoingAssets.reduce((sum, asset) => sum + asset.projectedValuePoints, 0),
    },
    buildEvaluationContext(body.offer.phase, userTeam.team.abbr, userTeam),
    userTeam.profile,
    {
      assets: outgoingAssets,
      totalValue: outgoingAssets.reduce((sum, asset) => sum + asset.projectedValuePoints, 0),
    },
    {
      assets: incomingAssets,
      totalValue: incomingAssets.reduce((sum, asset) => sum + asset.projectedValuePoints, 0),
    },
    buildEvaluationContext(body.offer.phase, aiTeam.team.abbr, aiTeam),
    aiTeam.profile,
  );

  return NextResponse.json({
    ok: true,
    extraAssets: [...extraPlayers, ...extraPicks],
    userInterest: {
      label: graded.user.label,
      band: graded.user.band,
      score: graded.user.score,
    },
    aiInterest: {
      label: graded.ai.label,
      band: graded.ai.band,
      score: graded.ai.score,
    },
    outgoingTotalValue: Number(
      outgoingAssets.reduce((sum, asset) => sum + asset.projectedValuePoints, 0).toFixed(1),
    ),
  });
};
