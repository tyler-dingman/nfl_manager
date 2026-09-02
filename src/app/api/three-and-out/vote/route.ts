import { NextRequest, NextResponse } from 'next/server';

import { getThreeAndOutPackage } from '@/features/three-and-out/data';
import { authError } from '@/server/auth/http';
import { currentUser } from '@/server/auth/request';
import { savePollVote } from '@/server/user/content-repository';

type VoteBody = { teamId?: string; questionId?: string; optionId?: string };

export async function POST(request: NextRequest) {
  const user = await currentUser(request);
  if (!user) return authError('Sign in to save your vote.', 401);
  const body = (await request.json()) as VoteBody;
  if (!body.teamId || !body.questionId || !body.optionId) {
    return NextResponse.json(
      { error: 'teamId, questionId, and optionId are required.' },
      { status: 400 },
    );
  }
  const data = getThreeAndOutPackage(body.teamId);
  const question = data.current.fourthDown;
  if (
    question.id !== body.questionId ||
    !question.options.some((option) => option.id === body.optionId)
  ) {
    return NextResponse.json({ error: 'Invalid poll option.' }, { status: 400 });
  }
  const existing = await savePollVote(user.id, question.id, body.optionId);
  const accepted = existing?.optionId === body.optionId;
  return NextResponse.json(
    { accepted, optionId: existing?.optionId, question },
    { status: accepted ? 201 : 409 },
  );
}
