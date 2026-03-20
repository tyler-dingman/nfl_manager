import { NextResponse } from 'next/server';

import {
  TRADE_ACCEPT_MARK_SCORE,
  TRADE_ACCEPT_WIGGLE,
  gradeTradeOffer,
} from '@/lib/trade-offer-evaluator';
import { buildTradePlayerAsset } from '@/lib/trade-player-valuation';
import {
  getDraftPickAssetById,
  getOrBuildProjectedRosterForTeam,
  getProjectedCapSpaceForTeam,
  getSaveStateResult,
  getSaveHeaderSnapshot,
  pushNewsItem,
  transferStoredPlayerToTeam,
  transferDraftPicksToTeam,
} from '@/server/api/store';
import { toPlayerDTO } from '@/server/api/trades';
import { buildEvaluationContext, buildTeamContexts } from '@/server/logic/trade-offer-generator';
import type { PlayerRowDTO } from '@/types/player';
import type { TradeOfferDTO } from '@/types/trade-offers';

type AcceptTradeOfferBody = {
  saveId?: string;
  offer?: TradeOfferDTO;
  extraIncomingPlayerIds?: string[];
  extraIncomingPickIds?: string[];
  extraOutgoingPlayerIds?: string[];
  extraOutgoingPickIds?: string[];
};

const ACCEPT_SCORE_FLOOR = Number((TRADE_ACCEPT_MARK_SCORE - TRADE_ACCEPT_WIGGLE).toFixed(3));

const capHitMillions = (player: PlayerRowDTO) =>
  Number(player.capHit.replace(/[^0-9.]/g, '')) || 0;

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
  const body = (await request.json()) as AcceptTradeOfferBody;
  if (!body.saveId || !body.offer) {
    return NextResponse.json(
      { ok: false, error: 'Missing trade offer acceptance inputs.' },
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

  const userRoster = getOrBuildProjectedRosterForTeam(state, userTeam.team.abbr).filter(
    (player) => player.status?.toLowerCase() !== 'cut',
  );
  const partnerRoster = getOrBuildProjectedRosterForTeam(state, aiTeam.team.abbr).filter(
    (player) => player.status?.toLowerCase() !== 'cut',
  );

  const extraIncomingPlayers = (body.extraIncomingPlayerIds ?? [])
    .slice(0, 3)
    .map((playerId) => partnerRoster.find((player) => player.id === playerId))
    .filter((player): player is (typeof partnerRoster)[number] => Boolean(player))
    .map((player) =>
      buildTradePlayerAsset(
        player,
        buildEvaluationContext(body.offer!.phase, userTeam.team.abbr, userTeam),
      ),
    );

  const extraOutgoingPlayers = (body.extraOutgoingPlayerIds ?? [])
    .slice(0, 3)
    .map((playerId) => userRoster.find((player) => player.id === playerId))
    .filter((player): player is (typeof userRoster)[number] => Boolean(player))
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

  const outgoingPlayerIds = new Set(
    outgoingAssets
      .filter((asset): asset is Extract<(typeof outgoingAssets)[number], { type: 'player' }> => asset.type === 'player')
      .map((asset) => asset.playerId),
  );
  const incomingPlayerIds = new Set(
    incomingAssets
      .filter((asset): asset is Extract<(typeof incomingAssets)[number], { type: 'player' }> => asset.type === 'player')
      .map((asset) => asset.playerId),
  );

  const outgoingPlayers = userRoster.filter((player) => outgoingPlayerIds.has(player.id));
  const incomingPlayers = partnerRoster.filter((player) => incomingPlayerIds.has(player.id));

  if (outgoingPlayers.length !== outgoingPlayerIds.size || incomingPlayers.length !== incomingPlayerIds.size) {
    return NextResponse.json(
      { ok: false, error: 'Unable to resolve one or more players in the proposal.' },
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

  const accepted =
    graded.ai.score >= ACCEPT_SCORE_FLOOR && nextUserCapSpace >= 0 && nextPartnerCapSpace >= 0;

  if (!accepted) {
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
          : 'The other team still is not interested in this package.',
    });
  }

  state.teamRosters[userTeam.team.abbr] = userRoster
    .filter((player) => !outgoingPlayerIds.has(player.id))
    .concat(incomingPlayers.map((player) => transferStoredPlayerToTeam(player, userTeam.team.abbr)));
  state.teamRosters[aiTeam.team.abbr] = partnerRoster
    .filter((player) => !incomingPlayerIds.has(player.id))
    .concat(outgoingPlayers.map((player) => transferStoredPlayerToTeam(player, aiTeam.team.abbr)));
  transferDraftPicksToTeam(
    state,
    incomingAssets.filter((asset) => asset.type === 'pick').map((asset) => asset.id),
    userTeam.team.abbr,
  );
  transferDraftPicksToTeam(
    state,
    outgoingAssets.filter((asset) => asset.type === 'pick').map((asset) => asset.id),
    aiTeam.team.abbr,
  );

  state.roster = state.teamRosters[userTeam.team.abbr];
  state.header.rosterCount = state.roster.length;
  state.header.capSpace = nextUserCapSpace;
  state.teamCaps[userTeam.team.abbr] = nextUserCapSpace;
  state.teamCaps[aiTeam.team.abbr] = nextPartnerCapSpace;

  const now = new Date().toISOString();
  outgoingPlayers.forEach((player) => {
    state.transactions.push({
      id: `tx_trade_offer_${Date.now()}_${Math.random().toString(16).slice(2)}`,
      type: 'trade',
      playerId: player.id,
      fromTeamAbbr: userTeam.team.abbr,
      toTeamAbbr: aiTeam.team.abbr,
      capHit: capHitMillions(player),
      createdAt: now,
    });
    state.rosterMoves.trades.push({
      playerId: player.id,
      name: `${player.firstName} ${player.lastName}`,
      timestamp: now,
    });
  });
  incomingPlayers.forEach((player) => {
    state.transactions.push({
      id: `tx_trade_offer_${Date.now()}_${Math.random().toString(16).slice(2)}`,
      type: 'trade',
      playerId: player.id,
      fromTeamAbbr: aiTeam.team.abbr,
      toTeamAbbr: userTeam.team.abbr,
      capHit: capHitMillions(player),
      createdAt: now,
    });
    state.rosterMoves.trades.push({
      playerId: player.id,
      name: `${player.firstName} ${player.lastName}`,
      timestamp: now,
    });
  });

  pushNewsItem(state, {
    type: 'trade',
    teamAbbr: userTeam.team.abbr,
    playerName: '',
    details: `${userTeam.team.abbr} accepted a trade offer from ${aiTeam.team.abbr}.`,
    severity: 'info',
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
    header: getSaveHeaderSnapshot(state),
    roster: state.roster.map((player) => toPlayerDTO(player)),
    partnerTeamAbbr: aiTeam.team.abbr,
  });
};
