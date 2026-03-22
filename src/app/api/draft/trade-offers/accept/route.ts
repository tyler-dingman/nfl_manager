import { NextResponse } from 'next/server';

import {
  TRADE_ACCEPT_MARK_SCORE,
  TRADE_ACCEPT_WIGGLE,
  gradeTradeOffer,
} from '@/lib/trade-offer-evaluator';
import { buildTradePlayerAsset } from '@/lib/trade-player-valuation';
import { acceptDraftTradeOffer } from '@/server/api/draft';
import { ensureDraftTradeContext, resolveDraftTradePickAssetById } from '@/server/api/draft-trade';
import { getOrBuildProjectedRosterForTeam, getProjectedCapSpaceForTeam } from '@/server/api/store';
import { buildEvaluationContext, buildTeamContexts } from '@/server/logic/trade-offer-generator';
import type { DraftSessionDTO } from '@/types/draft';
import type { PlayerRowDTO } from '@/types/player';
import type { SaveUnlocksDTO } from '@/types/save';
import type { TradeOfferDTO } from '@/types/trade-offers';

type AcceptDraftTradeOfferBody = {
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

const ACCEPT_SCORE_FLOOR = Number((TRADE_ACCEPT_MARK_SCORE - TRADE_ACCEPT_WIGGLE).toFixed(3));

const capHitMillions = (player: PlayerRowDTO) => Number(player.capHit.replace(/[^0-9.]/g, '')) || 0;

const computeResultingCapSpace = (
  baseCapSpace: number,
  outgoingPlayers: PlayerRowDTO[],
  incomingPlayers: PlayerRowDTO[],
) => {
  const outgoingCap = outgoingPlayers.reduce((sum, player) => sum + capHitMillions(player), 0);
  const incomingCap = incomingPlayers.reduce((sum, player) => sum + capHitMillions(player), 0);
  return Number((baseCapSpace + outgoingCap - incomingCap).toFixed(1));
};

export const POST = async (request: Request) => {
  const body = (await request.json()) as AcceptDraftTradeOfferBody;

  if (!body.saveId || !body.draftSessionId || !body.offer) {
    return NextResponse.json(
      { ok: false, error: 'Missing draft trade acceptance inputs.' },
      { status: 400 },
    );
  }

  try {
    const { resolvedSaveId, state, session } = ensureDraftTradeContext({
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

    if (incomingAssets.length === 0 && outgoingAssets.length === 0) {
      return NextResponse.json(
        { ok: false, error: 'Add at least one asset before offering a trade.' },
        { status: 400 },
      );
    }

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

    const outgoingPlayerIds = new Set(
      outgoingAssets
        .filter(
          (asset): asset is Extract<(typeof outgoingAssets)[number], { type: 'player' }> =>
            asset.type === 'player',
        )
        .map((asset) => asset.playerId),
    );
    const incomingPlayerIds = new Set(
      incomingAssets
        .filter(
          (asset): asset is Extract<(typeof incomingAssets)[number], { type: 'player' }> =>
            asset.type === 'player',
        )
        .map((asset) => asset.playerId),
    );

    const outgoingPlayers = userRoster.filter((player) => outgoingPlayerIds.has(player.id));
    const incomingPlayers = partnerRoster.filter((player) => incomingPlayerIds.has(player.id));

    if (
      outgoingPlayers.length !== outgoingPlayerIds.size ||
      incomingPlayers.length !== incomingPlayerIds.size
    ) {
      return NextResponse.json(
        { ok: false, error: 'Unable to resolve one or more player assets in this trade.' },
        { status: 400 },
      );
    }

    const nextUserCapSpace = computeResultingCapSpace(
      getProjectedCapSpaceForTeam(state, userTeam.team.abbr),
      outgoingPlayers,
      incomingPlayers,
    );
    const nextPartnerCapSpace = computeResultingCapSpace(
      getProjectedCapSpaceForTeam(state, aiTeam.team.abbr),
      incomingPlayers,
      outgoingPlayers,
    );

    const isAccepted =
      graded.ai.score >= ACCEPT_SCORE_FLOOR && nextUserCapSpace >= 0 && nextPartnerCapSpace >= 0;

    if (!isAccepted) {
      return NextResponse.json({
        ok: true,
        accepted: false,
        aiInterest: {
          label: graded.ai.label,
          band: graded.ai.band,
          score: graded.ai.score,
          probability: graded.ai.probability,
          explanation: graded.ai.explanation,
        },
        error:
          nextUserCapSpace < 0 || nextPartnerCapSpace < 0
            ? 'One team would exceed the cap after this trade.'
            : 'The other team is not interested in this package yet.',
      });
    }

    const appliedTrade = acceptDraftTradeOffer(body.draftSessionId, resolvedSaveId, {
      ...body.offer,
      incoming: {
        ...body.offer.incoming,
        assets: incomingAssets,
        totalValue: Number(
          incomingAssets.reduce((sum, asset) => sum + asset.projectedValuePoints, 0).toFixed(1),
        ),
      },
      outgoing: {
        ...body.offer.outgoing,
        assets: outgoingAssets,
        totalValue: Number(
          outgoingAssets.reduce((sum, asset) => sum + asset.projectedValuePoints, 0).toFixed(1),
        ),
      },
      aiInterest: {
        label: graded.ai.label,
        band: graded.ai.band,
        score: graded.ai.score,
        probability: graded.ai.probability,
        explanation: graded.ai.explanation,
      },
      userInterest: {
        label: graded.user.label,
        band: graded.user.band,
        score: graded.user.score,
        probability: graded.user.probability,
        explanation: graded.user.explanation,
      },
    });

    return NextResponse.json({
      ok: true,
      accepted: true,
      aiInterest: {
        label: graded.ai.label,
        band: graded.ai.band,
        score: graded.ai.score,
        probability: graded.ai.probability,
        explanation: graded.ai.explanation,
      },
      session: appliedTrade.session,
      roster: appliedTrade.roster,
      header: appliedTrade.header,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to accept draft trade';
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
};
