import { NextResponse } from 'next/server';

import { gradeTradeOffer } from '@/lib/trade-offer-evaluator';
import { buildTradePlayerAsset } from '@/lib/trade-player-valuation';
import { getDraftPickAssetById, getSaveStateResult } from '@/server/api/store';
import { buildEvaluationContext, buildTeamContexts } from '@/server/logic/trade-offer-generator';
import type { PlayerRowDTO } from '@/types/player';
import type { TradeOfferDTO } from '@/types/trade-offers';

type EvaluateTradeOfferBody = {
  saveId?: string;
  offer?: TradeOfferDTO;
  extraIncomingPlayerIds?: string[];
  extraIncomingPickIds?: string[];
  extraOutgoingPlayerIds?: string[];
  extraOutgoingPickIds?: string[];
};

export const POST = async (request: Request) => {
  const body = (await request.json()) as EvaluateTradeOfferBody;
  if (!body.saveId || !body.offer) {
    return NextResponse.json(
      { ok: false, error: 'Missing trade offer evaluation inputs.' },
      { status: 400 },
    );
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
    return NextResponse.json(
      { ok: false, error: 'Unable to resolve trade offer teams.' },
      { status: 400 },
    );
  }

  const extraIncomingPlayers = (body.extraIncomingPlayerIds ?? [])
    .map((playerId) => aiTeam.roster.find((player) => player.id === playerId))
    .filter((player): player is PlayerRowDTO => Boolean(player))
    .slice(0, 3)
    .map((player) =>
      buildTradePlayerAsset(
        player,
        buildEvaluationContext(body.offer!.phase, userTeam.team.abbr, userTeam),
      ),
    );

  const extraOutgoingPlayers = (body.extraOutgoingPlayerIds ?? [])
    .map((playerId) => userTeam.roster.find((player) => player.id === playerId))
    .filter((player): player is PlayerRowDTO => Boolean(player))
    .slice(0, 3)
    .map((player) =>
      buildTradePlayerAsset(
        player,
        buildEvaluationContext(body.offer!.phase, aiTeam.team.abbr, aiTeam),
      ),
    );

  const extraIncomingPicks = (body.extraIncomingPickIds ?? [])
    .slice(0, 3)
    .map((pickId) => getDraftPickAssetById(state, pickId))
    .filter((pick): pick is NonNullable<typeof pick> => Boolean(pick))
    .filter((pick) => pick.owningTeamAbbr === aiTeam.team.abbr);

  const extraOutgoingPicks = (body.extraOutgoingPickIds ?? [])
    .slice(0, 3)
    .map((pickId) => getDraftPickAssetById(state, pickId))
    .filter((pick): pick is NonNullable<typeof pick> => Boolean(pick))
    .filter((pick) => pick.owningTeamAbbr === userTeam.team.abbr);

  const incomingAssets = [
    ...body.offer.incoming.assets,
    ...extraIncomingPlayers,
    ...extraIncomingPicks,
  ];
  const outgoingAssets = [
    ...body.offer.outgoing.assets,
    ...extraOutgoingPlayers,
    ...extraOutgoingPicks,
  ];

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
    extraIncomingAssets: [...extraIncomingPlayers, ...extraIncomingPicks],
    extraOutgoingAssets: [...extraOutgoingPlayers, ...extraOutgoingPicks],
    userInterest: {
      label: graded.user.label,
      band: graded.user.band,
      score: graded.user.score,
      probability: graded.user.probability,
      explanation: graded.user.explanation,
    },
    aiInterest: {
      label: graded.ai.label,
      band: graded.ai.band,
      score: graded.ai.score,
      probability: graded.ai.probability,
      explanation: graded.ai.explanation,
    },
    incomingTotalValue: Number(
      incomingAssets.reduce((sum, asset) => sum + asset.projectedValuePoints, 0).toFixed(1),
    ),
    outgoingTotalValue: Number(
      outgoingAssets.reduce((sum, asset) => sum + asset.projectedValuePoints, 0).toFixed(1),
    ),
    aiExplanation: graded.ai.explanation,
  });
};
