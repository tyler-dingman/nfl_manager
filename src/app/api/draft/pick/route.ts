import { NextResponse } from 'next/server';

import {
  findSaveIdForDraftSession,
  getDraftSession,
  pickDraftPlayer,
  restoreDraftSession,
} from '@/server/api/draft';
import { getUserPickGrade } from '@/lib/draft-grading';
import type { DraftSessionDTO } from '@/types/draft';
import type { PlayerRowDTO } from '@/types/player';
import type { SaveUnlocksDTO } from '@/types/save';

const assignStoredUserGrade = (
  session: DraftSessionDTO,
  playerId: string,
  teamNeeds: string[],
) => {
  const draftedPlayer = session.prospects.find((player) => player.id === playerId);
  const draftedPick = session.picks.find((pick) => pick.selectedPlayerId === playerId);

  if (!draftedPlayer || !draftedPick) {
    return null;
  }

  const grade = getUserPickGrade({
    playerRanking: draftedPlayer.rank ?? draftedPlayer.projectedPick ?? null,
    pickNumber: draftedPick.overall,
    teamNeeds,
    playerPosition: draftedPlayer.position,
  });

  draftedPick.grade = grade.letter;
  draftedPick.gradeReasons = grade.reasons;

  return { draftedPlayer, grade };
};

export const POST = async (request: Request) => {
  let body:
    | {
        draftSessionId?: string;
        saveId?: string;
        playerId?: string;
        teamNeeds?: string[];
        sessionSnapshot?: DraftSessionDTO;
        saveSnapshot?: {
          teamAbbr: string;
          year?: number;
          capSpace: number;
          capLimit: number;
          roster: PlayerRowDTO[];
          phase?: string;
          unlocked?: SaveUnlocksDTO;
          createdAt?: string;
        };
      }
    | undefined = {};
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

  const teamNeeds = body.teamNeeds ?? [];

  try {
    const resolvedSaveId = findSaveIdForDraftSession(body.draftSessionId) ?? body.saveId;

    if (body.sessionSnapshot) {
      restoreDraftSession(resolvedSaveId, body.sessionSnapshot, body.saveSnapshot);
    }

    pickDraftPlayer(body.draftSessionId, body.playerId, resolvedSaveId);
    const session = getDraftSession(body.draftSessionId, resolvedSaveId);
    const result = assignStoredUserGrade(session, body.playerId, teamNeeds);
    if (!result) {
      return NextResponse.json({ ok: false, error: 'Drafted player not found' }, { status: 404 });
    }

    return NextResponse.json({
      ok: true,
      session,
      grade: result.grade,
      draftedPlayer: result.draftedPlayer,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to make draft pick';

    if (
      body.sessionSnapshot &&
      (message === 'Draft session not found' ||
        message === 'Save not found' ||
        message === 'Not user pick' ||
        message === 'Player not available')
    ) {
      try {
        const restoredSaveId = body.saveId!;
        const sessionSnapshot = body.sessionSnapshot;
        if (!sessionSnapshot) {
          return NextResponse.json({ ok: false, error: message }, { status: 400 });
        }
        restoreDraftSession(restoredSaveId, sessionSnapshot, body.saveSnapshot);
        pickDraftPlayer(body.draftSessionId, body.playerId, restoredSaveId);
        const updatedSession = getDraftSession(body.draftSessionId, restoredSaveId);
        const result = assignStoredUserGrade(updatedSession, body.playerId, teamNeeds);
        if (!result) {
          return NextResponse.json({ ok: false, error: 'Drafted player not found' }, { status: 404 });
        }

        return NextResponse.json({
          ok: true,
          session: updatedSession,
          grade: result.grade,
          draftedPlayer: result.draftedPlayer,
        });
      } catch (restoreError) {
        const restoreMessage =
          restoreError instanceof Error ? restoreError.message : 'Unable to make draft pick';
        return NextResponse.json({ ok: false, error: restoreMessage }, { status: 400 });
      }
    }

    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
};
