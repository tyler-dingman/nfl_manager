import { NextResponse } from 'next/server';

import { pickDraftPlayer } from '@/server/api/draft';
import type { PlayerRowDTO } from '@/types/player';

const NEED_ORDER = ['QB', 'WR', 'OT', 'EDGE', 'CB', 'DL', 'RB', 'LB', 'S', 'TE', 'OL', 'K'];

const getTeamNeeds = (teamAbbr: string): string[] => {
  const seed = teamAbbr.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return Array.from({ length: 3 }, (_, index) => NEED_ORDER[(seed + index) % NEED_ORDER.length]);
};

const buildDraftGrade = (player: PlayerRowDTO, teamNeeds: string[]) => {
  const rank = player.rank ?? 999;
  const isNeed = teamNeeds.includes(player.position);

  if (isNeed && rank <= 10) {
    return {
      letter: 'A',
      reason: `${player.position} was a top need and you landed a top-10 prospect.`,
    };
  }
  if (isNeed && rank <= 25) {
    return {
      letter: 'B',
      reason: `${player.position} filled a need and came off the board in the top 25.`,
    };
  }
  if (!isNeed && rank <= 25) {
    return {
      letter: 'C',
      reason: `${player.position} was not a primary need, but the value in the top 25 was strong.`,
    };
  }
  if (rank <= 75) {
    return {
      letter: 'D',
      reason: `${player.position} was a reach compared to the top-ranked available prospects.`,
    };
  }
  return {
    letter: 'F',
    reason: `${player.position} was a big reach relative to the board.`,
  };
};

export const POST = async (request: Request) => {
  let body: { draftSessionId?: string; saveId?: string; playerId?: string } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    body = {};
  }

  if (!body.draftSessionId || !body.playerId || !body.saveId) {
    return NextResponse.json(
      { ok: false, error: 'draftSessionId, playerId, and saveId are required' },
      { status: 400 },
    );
  }

  try {
    const session = pickDraftPlayer(body.draftSessionId, body.playerId, body.saveId);
    const draftedPlayer = session.prospects.find((player) => player.id === body.playerId);
    if (!draftedPlayer) {
      return NextResponse.json(
        { ok: false, error: 'Drafted player not found' },
        { status: 404 },
      );
    }

    const teamNeeds = getTeamNeeds(session.userTeamAbbr);
    const grade = buildDraftGrade(draftedPlayer, teamNeeds);

    return NextResponse.json({
      ok: true,
      session,
      grade,
      draftedPlayer,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to make draft pick';
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
};
