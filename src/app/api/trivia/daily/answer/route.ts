import { NextRequest, NextResponse } from 'next/server';

import { authError, assertSameOrigin } from '@/server/auth/http';
import { currentUser } from '@/server/auth/request';
import {
  getDailyQuestion,
  answerDailyQuestion,
  getDailyResponseTime,
  getMoveTheChainsAccount,
} from '@/server/trivia/repository';

export async function POST(request: NextRequest) {
  const user = await currentUser(request);
  try {
    assertSameOrigin(request);
    const body = (await request.json()) as {
      teamId?: string;
      dailyQuestionId?: string;
      questionId?: string;
      selectedAnswer?: 'A' | 'B' | 'C' | 'D';
      responseTimeMs?: number;
    };
    if (
      !body.teamId ||
      !body.dailyQuestionId ||
      !body.questionId ||
      !body.selectedAnswer ||
      !Number.isFinite(body.responseTimeMs)
    )
      return NextResponse.json({ error: 'Incomplete answer.' }, { status: 400 });
    const question = await getDailyQuestion(
      body.teamId.toUpperCase(),
      new Date().toISOString().slice(0, 10),
    );
    if (
      !question ||
      question.dailyQuestionId !== body.dailyQuestionId ||
      question.id !== body.questionId
    )
      return NextResponse.json({ error: 'Daily question is invalid.' }, { status: 400 });
    if (!user) {
      const correct = body.selectedAnswer === question.correctAnswer;
      return NextResponse.json({
        ok: true,
        accepted: true,
        result: { correct, points: 0 },
        answer: question.correctAnswer,
        explanation: question.explanation,
        anonymous: true,
      });
    }
    const result = await answerDailyQuestion({
      userId: user.id,
      dailyQuestionId: body.dailyQuestionId,
      questionId: body.questionId,
      selectedAnswer: body.selectedAnswer,
      responseTimeMs: await getDailyResponseTime(user.id, body.dailyQuestionId),
      correctAnswer: String(question.correctAnswer) as 'A' | 'B' | 'C' | 'D',
    });
    return NextResponse.json({
      ok: true,
      ...result,
      answer: question.correctAnswer,
      explanation: question.explanation,
      moveTheChains: await getMoveTheChainsAccount(user.id),
    });
  } catch {
    return NextResponse.json({ error: 'Unable to record Trivia answer.' }, { status: 400 });
  }
}
