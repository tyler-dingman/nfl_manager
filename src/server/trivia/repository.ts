import { randomUUID } from 'node:crypto';

import { authDb } from '@/server/auth/database';
import { awardYardsInTransaction } from '@/server/rewards/repository';
import type { TriviaAnswerChoice, TriviaMode } from '@/features/trivia/types';

export async function listActiveQuestions(teamId: string, limit = 100) {
  const allowUnverified = process.env.NODE_ENV !== 'production';
  return authDb()<Array<{ id: string; [key: string]: unknown }>>`
    SELECT id, team_id AS "teamId", question, answer_a AS "answerA", answer_b AS "answerB",
      answer_c AS "answerC", answer_d AS "answerD", correct_answer AS "correctAnswer",
      explanation, category, verified, active
    FROM trivia_questions
    WHERE team_id = ${teamId} AND active = true AND (verified = true OR ${allowUnverified})
    ORDER BY id LIMIT ${limit}`;
}

export async function getDailyQuestion(teamId: string, date: string) {
  const rows = await authDb()<Array<Record<string, unknown>>>`
    SELECT d.id AS "dailyQuestionId", q.id, q.team_id AS "teamId", q.question,
      q.answer_a AS "answerA", q.answer_b AS "answerB", q.answer_c AS "answerC", q.answer_d AS "answerD",
      q.correct_answer AS "correctAnswer", q.explanation, q.category, q.verified, q.active
    FROM trivia_daily_questions d JOIN trivia_questions q ON q.id = d.question_id
    WHERE d.team_id = ${teamId} AND d.question_date = ${date} AND q.active = true`;
  return rows[0] ?? null;
}

export async function ensureDailyQuestion(teamId: string, date: string) {
  const existing = await getDailyQuestion(teamId, date);
  if (existing) return existing;
  const questions = await listActiveQuestions(teamId);
  if (!questions.length) return null;
  let hash = 0;
  for (const character of `${teamId}:${date}`) hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  const question = questions[hash % questions.length];
  await authDb()`
    INSERT INTO trivia_daily_questions (id, team_id, question_date, question_id)
    VALUES (${randomUUID()}, ${teamId}, ${date}, ${question.id})
    ON CONFLICT (team_id, question_date) DO NOTHING`;
  return getDailyQuestion(teamId, date);
}

export async function getDailyAnswer(userId: string, dailyQuestionId: string) {
  const rows = await authDb()<Array<Record<string, unknown>>>`
    SELECT selected_answer AS "selectedAnswer", correct, response_time_ms AS "responseTimeMs", points_awarded AS "pointsAwarded", answered_at AS "answeredAt"
    FROM trivia_answers WHERE user_id = ${userId} AND daily_question_id = ${dailyQuestionId}`;
  return rows[0] ?? null;
}

export async function markDailyPresented(userId: string, dailyQuestionId: string) {
  await authDb()`INSERT INTO trivia_daily_views(user_id,daily_question_id) VALUES(${userId},${dailyQuestionId}) ON CONFLICT DO NOTHING`;
}
export async function getDailyResponseTime(userId: string, dailyQuestionId: string) {
  const rows = await authDb()<
    Array<{ elapsed: number }>
  >`SELECT greatest(0,extract(epoch FROM(now()-presented_at))*1000)::int AS elapsed FROM trivia_daily_views WHERE user_id=${userId} AND daily_question_id=${dailyQuestionId}`;
  return Math.min(15000, rows[0]?.elapsed ?? 15000);
}

export async function answerDailyQuestion(input: {
  userId: string;
  dailyQuestionId: string;
  questionId: string;
  selectedAnswer: TriviaAnswerChoice;
  responseTimeMs: number;
  correctAnswer: TriviaAnswerChoice;
}) {
  const result = {
    correct: input.selectedAnswer === input.correctAnswer,
    points: 0,
  };
  const { calculateTriviaPoints } = await import('@/features/trivia/engine');
  result.points = calculateTriviaPoints(result.correct, input.responseTimeMs);
  const sql = authDb();
  return sql.begin(async (tx) => {
    const inserted = await tx<Array<{ id: string }>>`
      INSERT INTO trivia_answers (id, user_id, question_id, daily_question_id, selected_answer, correct, response_time_ms, points_awarded)
      VALUES (${randomUUID()}, ${input.userId}, ${input.questionId}, ${input.dailyQuestionId}, ${input.selectedAnswer}, ${result.correct}, ${input.responseTimeMs}, ${result.points})
      ON CONFLICT (user_id, daily_question_id) DO NOTHING RETURNING id`;
    if (!inserted[0])
      return {
        accepted: false,
        existing: await getDailyAnswer(input.userId, input.dailyQuestionId),
        result,
      };
    await tx`
      INSERT INTO trivia_stats (user_id, lifetime_points, weekly_points, questions_answered, correct_answers)
      VALUES (${input.userId}, ${result.points}, ${result.points}, 1, ${result.correct ? 1 : 0})
      ON CONFLICT (user_id) DO UPDATE SET
        lifetime_points = trivia_stats.lifetime_points + ${result.points},
        weekly_points = trivia_stats.weekly_points + ${result.points},
        questions_answered = trivia_stats.questions_answered + 1,
        correct_answers = trivia_stats.correct_answers + ${result.correct ? 1 : 0},
        updated_at = now()`;
    if (result.correct) {
      await awardYardsInTransaction(tx, {
        userId: input.userId,
        action: 'DAILY_TRIVIA_CORRECT',
        sourceType: 'TRIVIA_DAILY',
        sourceId: input.dailyQuestionId,
      });
    }
    return { accepted: true, existing: null, result };
  });
}

export async function getMoveTheChainsAccount(userId: string) {
  const rows = await authDb()<Array<Record<string, unknown>>>`
    SELECT current_drive_yards AS "currentDriveYards", touchdowns, lifetime_yards AS "lifetimeYards"
    FROM move_the_chains_accounts WHERE user_id = ${userId}`;
  return rows[0] ?? { currentDriveYards: 0, touchdowns: 0, lifetimeYards: 0 };
}

export async function getTriviaStats(userId: string) {
  const rows = await authDb()<Array<Record<string, unknown>>>`
    SELECT lifetime_points AS "lifetimePoints", weekly_points AS "weeklyPoints", questions_answered AS "questionsAnswered",
      correct_answers AS "correctAnswers", games_played AS "gamesPlayed", current_streak AS "currentStreak", best_streak AS "bestStreak",
      CASE WHEN questions_answered = 0 THEN 0 ELSE round(correct_answers::numeric / questions_answered * 100, 1) END AS accuracy
    FROM trivia_stats WHERE user_id = ${userId}`;
  return (
    rows[0] ?? {
      lifetimePoints: 0,
      weeklyPoints: 0,
      questionsAnswered: 0,
      correctAnswers: 0,
      gamesPlayed: 0,
      currentStreak: 0,
      bestStreak: 0,
      accuracy: 0,
    }
  );
}

export async function startTriviaGame(
  userId: string,
  mode: TriviaMode,
  teamId: string,
  questionIds: string[],
) {
  const sql = authDb();
  return sql.begin(async (tx) => {
    const gameRows = await tx<Array<{ id: string }>>`
      INSERT INTO trivia_games (id, mode, team_id, created_by_user_id) VALUES (${randomUUID()}, ${mode}, ${teamId}, ${userId}) RETURNING id`;
    const gameId = gameRows[0].id;
    for (const [index, questionId] of questionIds.entries()) {
      await tx`INSERT INTO trivia_game_questions (game_id, question_id, position) VALUES (${gameId}, ${questionId}, ${index + 1})`;
    }
    await tx`INSERT INTO trivia_game_participants (game_id, user_id) VALUES (${gameId}, ${userId})`;
    return { gameId };
  });
}
