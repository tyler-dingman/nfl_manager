import { NextRequest, NextResponse } from 'next/server';

import { TEAM_LIST } from '@/data/teams';
import { currentUser } from '@/server/auth/request';
import {
  ensureDailyQuestion,
  getDailyAnswer,
  getMoveTheChainsAccount,
  markDailyPresented,
} from '@/server/trivia/repository';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const teamId = (request.nextUrl.searchParams.get('team') ?? '').toUpperCase();
  if (!TEAM_LIST.some((team) => team.abbr === teamId))
    return NextResponse.json({ error: 'Unknown team.' }, { status: 404 });
  const question = await ensureDailyQuestion(teamId, new Date().toISOString().slice(0, 10));
  if (!question)
    return NextResponse.json(
      { error: 'No Trivia questions are available for this team.' },
      { status: 404 },
    );
  const user = await currentUser(request);
  const answer = user ? await getDailyAnswer(user.id, String(question.dailyQuestionId)) : null;
  if (user && !answer) await markDailyPresented(user.id, String(question.dailyQuestionId));
  const chains = user ? await getMoveTheChainsAccount(user.id) : null;
  return NextResponse.json({
    teamId,
    dailyQuestion: {
      id: question.dailyQuestionId,
      questionId: question.id,
      question: question.question,
      answers: {
        A: question.answerA,
        B: question.answerB,
        C: question.answerC,
        D: question.answerD,
      },
      explanation: answer ? question.explanation : undefined,
      category: question.category,
      completed: Boolean(answer),
      result: answer ? { ...answer, correctAnswer: question.correctAnswer } : null,
    },
    moveTheChains: chains,
  });
}
