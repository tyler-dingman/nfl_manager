import { NextResponse } from 'next/server';

import { gradeTradeOffer } from '@/lib/trade-offer-evaluator';
import { buildTradePlayerAsset } from '@/lib/trade-player-valuation';
import { ensureDraftTradeContext, resolveDraftTradePickAssetById } from '@/server/api/draft-trade';
import { getOrBuildProjectedRosterForTeam } from '@/server/api/store';
import { buildEvaluationContext, buildTeamContexts } from '@/server/logic/trade-offer-generator';
import type { DraftSessionDTO } from '@/types/draft';
import type { PlayerRowDTO } from '@/types/player';
import type { SaveUnlocksDTO } from '@/types/save';
import type { TradeOfferDTO } from '@/types/trade-offers';

type EvaluateDraftTradeOfferBody = {
  saveId?: string;
  draftSessionId?: string;
  offer?: TradeOfferDTO;
  extraIncomingPlayerIds?: string[];
  extraIncomingPickIds?: string[];
  extraOutgoingPlayerIds?: string[];
  extraOutgoingPickIds?: string[];
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
  const body = (await request.json()) as EvaluateDraftTradeOfferBody;
  if (!body.saveId || !body.draftSessionId || !body.offer) {
    return NextResponse.json(
      { ok: false, error: 'Missing draft trade evaluation inputs.' },
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

    const contexts = buildTeamContexts(state);
    const userTeam = contexts.get(session.userTeamAbbr.toUpperCase());
    const aiTeam = contexts.get(body.offer.proposingTeamAbbr.toUpperCase());
    if (!userTeam || !aiTeam) {
      return NextResponse.json(
        { ok: false, error: 'Unable to resolve draft trade teams.' },
        { status: 400 },
      );
    }

    const userRoster = getOrBuildProjectedRosterForTeam(state, userTeam.team.abbr).filter(
      (player) => player.status?.toLowerCase() !== 'cut',
    );
    const partnerRoster = getOrBuildProjectedRosterForTeam(state, aiTeam.team.abbr).filter(
      (player) => player.status?.toLowerCase() !== 'cut',
    );

    const extraIncomingPlayers = (body.extraIncomingPlayerIds ?? [])
      .slice(0, 5)
      .map((playerId) => partnerRoster.find((player) => player.id === playerId))
      .filter((player): player is (typeof partnerRoster)[number] => Boolean(player))
      .map((player) =>
        buildTradePlayerAsset(
          player,
          buildEvaluationContext(body.offer!.phase, userTeam.team.abbr, userTeam),
        ),
      );

    const extraOutgoingPlayers = (body.extraOutgoingPlayerIds ?? [])
      .slice(0, 5)
      .map((playerId) => userRoster.find((player) => player.id === playerId))
      .filter((player): player is (typeof userRoster)[number] => Boolean(player))
      .map((player) =>
        buildTradePlayerAsset(
          player,
          buildEvaluationContext(body.offer!.phase, aiTeam.team.abbr, aiTeam),
        ),
      );

    const extraIncomingPicks = (body.extraIncomingPickIds ?? [])
      .slice(0, 5)
      .map((pickId) => resolveDraftTradePickAssetById(state, session, pickId))
      .filter((pick): pick is NonNullable<typeof pick> => Boolean(pick))
      .filter((pick) => pick.owningTeamAbbr === aiTeam.team.abbr);

    const extraOutgoingPicks = (body.extraOutgoingPickIds ?? [])
      .slice(0, 5)
      .map((pickId) => resolveDraftTradePickAssetById(state, session, pickId))
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
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to evaluate this draft trade.';
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
};
