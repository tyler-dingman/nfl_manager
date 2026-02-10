import { NextResponse } from 'next/server';

import { getReSignQuote } from '@/lib/quotes';
import { clampYears } from '@/lib/contracts';
import { scoreResignOffer, decideResignAcceptance } from '@/server/logic/re-sign';
import {
  getSaveStateResult,
  pushNewsItem,
  resignExpiringContractInState,
  resignPlayerInState,
} from '@/server/api/store';
import type { ResignErrorDTO, ResignResultDTO } from '@/types/resign';
import type { PlayerRowDTO } from '@/types/player';

type ResignPayload = {
  saveId?: string;
  teamAbbr?: string;
  playerId?: string;
  years?: number;
  apy?: number;
  guaranteed?: number;
};

const TEAM_NAME_BY_ABBR: Record<string, string> = {
  PHI: 'Philadelphia Eagles',
  KC: 'Kansas City Chiefs',
  SF: 'San Francisco 49ers',
};

const formatApy = (apy: number) => `$${apy.toFixed(1)}M`;

export const POST = async (request: Request) => {
  let body: ResignPayload = {};
  try {
    body = (await request.json()) as ResignPayload;
  } catch {
    body = {};
  }

  if (
    !body.saveId ||
    !body.playerId ||
    typeof body.years !== 'number' ||
    typeof body.apy !== 'number' ||
    typeof body.guaranteed !== 'number'
  ) {
    return NextResponse.json<ResignErrorDTO>(
      { ok: false, error: 'saveId, playerId, years, apy, and guaranteed are required' },
      { status: 400 },
    );
  }

  const stateResult = getSaveStateResult(body.saveId);
  if (!stateResult.ok) {
    return NextResponse.json<ResignErrorDTO>(
      { ok: false, error: stateResult.error },
      { status: 404 },
    );
  }

  const state = stateResult.data;
  const player = state.roster.find((item) => item.id === body.playerId) ?? null;
  const expiringContract = state.expiringContracts.find((entry) => entry.id === body.playerId);

  if (!player && !expiringContract) {
    return NextResponse.json<ResignErrorDTO>(
      { ok: false, error: 'Player not found in expiring list' },
      { status: 404 },
    );
  }

  const teamAbbr = (body.teamAbbr ?? state.header.teamAbbr ?? '').toUpperCase();
  const teamName = TEAM_NAME_BY_ABBR[teamAbbr] ?? teamAbbr;
  const expectedApyOverride = expiringContract
    ? Number((expiringContract.estValue / 1_000_000).toFixed(2))
    : undefined;

  const offerPlayer = player ?? {
    id: expiringContract!.id,
    firstName: expiringContract!.name.split(' ')[0] ?? expiringContract!.name,
    lastName: expiringContract!.name.split(' ').slice(1).join(' ') || expiringContract!.name,
    position: expiringContract!.pos,
    contractYearsRemaining: 0,
    capHit: '$0.0M',
    status: 'Expiring',
  };

  const years = clampYears(body.years);
  const breakdown = scoreResignOffer({
    saveId: body.saveId,
    teamAbbr,
    player: offerPlayer,
    years,
    apy: body.apy,
    guaranteed: body.guaranteed,
    expectedApyOverride,
  });

  const accepted = decideResignAcceptance(breakdown);
  const quote = getReSignQuote({
    accepted,
    position: offerPlayer.position,
    teamName,
  });

  let updatedHeader = state.header;
  let updatedPlayer: PlayerRowDTO | null = player ?? null;
  if (accepted) {
    if (player) {
      const result = resignPlayerInState(state, player.id, years, body.apy, body.guaranteed);
      updatedHeader = result.header;
      updatedPlayer = result.player;
    } else if (expiringContract) {
      const result = resignExpiringContractInState(
        state,
        expiringContract,
        years,
        body.apy,
        body.guaranteed,
      );
      updatedHeader = result.header;
      updatedPlayer = result.player;
    }
  }

  const playerName = `${offerPlayer.firstName} ${offerPlayer.lastName}`;
  const details = accepted
    ? `${teamName} re-sign ${playerName} (${years} yrs, ${formatApy(body.apy)}/yr).`
    : `${playerName} declines offer from ${teamName}. Testing free agency.`;

  const newsItem = pushNewsItem(state, {
    type: accepted ? 'reSignAccepted' : 'reSignDeclined',
    teamAbbr,
    playerName,
    details,
    quote,
    severity: accepted ? 'success' : 'warning',
  });

  const payload: ResignResultDTO = {
    ok: true,
    accepted,
    playerId: offerPlayer.id,
    teamAbbr,
    years,
    apy: body.apy,
    guaranteed: body.guaranteed,
    expectedApy: breakdown.expectedApy,
    expectedYearsRange: breakdown.expectedYearsRange,
    interestScore: breakdown.interestScore,
    agentPersona: breakdown.agentPersona,
    reasoningTags: breakdown.reasoningTags,
    quote,
    newsItem,
    header: accepted ? updatedHeader : undefined,
    player: accepted && updatedPlayer ? updatedPlayer : undefined,
  };

  return NextResponse.json(payload);
};
