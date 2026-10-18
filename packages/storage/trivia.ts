import { Storage } from './core';
import { D1Rewards } from './rewards';
import { calculateTriviaPoints } from '../../src/features/trivia/engine';
import { normalizeTriviaStats } from '../../src/features/trivia/stats';
export class D1DailyTrivia {
  constructor(
    readonly s: Storage,
    readonly production = true,
  ) {}
  async listActiveQuestions(team: string, limit = 100) {
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw Error('Question page limit');
    const rows = await this.s.rows<any>(
      'SELECT id,team_id AS teamId,question,answer_a AS answerA,answer_b AS answerB,answer_c AS answerC,answer_d AS answerD,correct_answer AS correctAnswer,explanation,category,verified,active FROM app_trivia_questions WHERE team_id=? AND active=1 AND (verified=1 OR ?=1) ORDER BY id LIMIT ?',
      [team, this.production ? 0 : 1, limit],
    );
    return rows.map((r) => ({ ...r, verified: Boolean(r.verified), active: Boolean(r.active) }));
  }
  async getDailyQuestion(team: string, date: string) {
    const [row] = await this.s.rows<any>(
      'SELECT d.id AS dailyQuestionId,q.id,q.team_id AS teamId,q.question,q.answer_a AS answerA,q.answer_b AS answerB,q.answer_c AS answerC,q.answer_d AS answerD,q.correct_answer AS correctAnswer,q.explanation,q.category,q.verified,q.active FROM app_trivia_daily d JOIN app_trivia_questions q ON q.id=d.question_id WHERE d.team_id=? AND d.question_date=? AND q.active=1',
      [team, date],
    );
    return row ? { ...row, verified: Boolean(row.verified), active: Boolean(row.active) } : null;
  }
  async ensureDailyQuestion(team: string, date: string) {
    const prior = await this.getDailyQuestion(team, date);
    if (prior) return prior;
    const questions = await this.listActiveQuestions(team);
    if (!questions.length) return null;
    let hash = 0;
    for (const c of `${team}:${date}`) hash = (hash * 31 + c.charCodeAt(0)) >>> 0;
    await this.s
      .statement(
        'INSERT INTO app_trivia_daily(id,team_id,question_date,question_id) VALUES(?,?,?,?) ON CONFLICT(team_id,question_date) DO NOTHING',
        [crypto.randomUUID(), team, date, questions[hash % questions.length].id],
      )
      .run();
    return this.getDailyQuestion(team, date);
  }
  async getDailyAnswer(user: string, daily: string) {
    const [row] = await this.s.rows<any>(
      'SELECT selected_answer AS selectedAnswer,correct,response_time_ms AS responseTimeMs,points_awarded AS pointsAwarded,answered_at AS answeredAt FROM app_trivia_answers WHERE user_id=? AND daily_id=?',
      [user, daily],
    );
    return row
      ? { ...row, correct: Boolean(row.correct), answeredAt: new Date(row.answeredAt) }
      : null;
  }
  async markDailyPresented(user: string, daily: string) {
    await this.s
      .statement(
        'INSERT INTO app_trivia_views(user_id,daily_id,presented_at) VALUES(?,?,?) ON CONFLICT DO NOTHING',
        [user, daily, Date.now()],
      )
      .run();
  }
  async getDailyResponseTime(user: string, daily: string) {
    const [row] = await this.s.rows<{ presented_at: number }>(
      'SELECT presented_at FROM app_trivia_views WHERE user_id=? AND daily_id=?',
      [user, daily],
    );
    return Math.min(15000, Math.max(0, row ? Date.now() - row.presented_at : 15000));
  }
  async answerDailyQuestion(input: {
    userId: string;
    dailyQuestionId: string;
    questionId: string;
    selectedAnswer: string;
    responseTimeMs: number;
    correctAnswer: string;
  }) {
    if (!['A', 'B', 'C', 'D'].includes(input.selectedAnswer)) throw Error('Invalid answer choice');
    // Read the answer from authoritative storage; caller-supplied truth/timing is never trusted.
    const [question] = await this.s.rows<any>(
      'SELECT q.id,q.correct_answer FROM app_trivia_daily d JOIN app_trivia_questions q ON q.id=d.question_id WHERE d.id=? AND q.active=1 AND (q.verified=1 OR ?=1)',
      [input.dailyQuestionId, this.production ? 0 : 1],
    );
    if (!question || question.id !== input.questionId) throw Error('Daily question mismatch');
    const elapsed = await this.getDailyResponseTime(input.userId, input.dailyQuestionId);
    const correct = input.selectedAnswer === question.correct_answer;
    const result = { correct, points: calculateTriviaPoints(correct, elapsed) };
    for (let attempt = 0; attempt < 4; attempt++) {
      const existing = await this.getDailyAnswer(input.userId, input.dailyQuestionId);
      if (existing)
        return {
          accepted: false,
          existing,
          result: { correct: existing.correct, points: existing.pointsAwarded },
        };
      const rewards = correct
        ? await new D1Rewards(this.s).plan({
            userId: input.userId,
            action: 'DAILY_TRIVIA_CORRECT',
            sourceType: 'TRIVIA_DAILY',
            sourceId: input.dailyQuestionId,
          })
        : null;
      const statements = [
        this.s.statement(
          'INSERT INTO app_trivia_answers(id,user_id,daily_id,question_id,selected_answer,correct,response_time_ms,points_awarded,answered_at) VALUES(?,?,?,?,?,?,?,?,?)',
          [
            crypto.randomUUID(),
            input.userId,
            input.dailyQuestionId,
            input.questionId,
            input.selectedAnswer,
            correct ? 1 : 0,
            elapsed,
            result.points,
            Date.now(),
          ],
        ),
        this.s.statement(
          'INSERT INTO app_trivia_stats(user_id,lifetime_points,weekly_points,questions_answered,correct_answers) VALUES(?,?,?,1,?) ON CONFLICT(user_id) DO UPDATE SET lifetime_points=lifetime_points+excluded.lifetime_points,weekly_points=weekly_points+excluded.weekly_points,questions_answered=questions_answered+1,correct_answers=correct_answers+excluded.correct_answers',
          [input.userId, result.points, result.points, correct ? 1 : 0],
        ),
        ...(rewards?.statements ?? []),
      ];
      try {
        await this.s.batch(statements);
        return { accepted: true, existing: null, result };
      } catch (error) {
        if (attempt === 3) throw error;
      }
    }
    throw Error('Trivia update not confirmed');
  }
  async getMoveTheChainsAccount(user: string) {
    const { version, ...account } = await new D1Rewards(this.s).account(user);
    return account;
  }
  async getTriviaStats(user: string) {
    const [row] = await this.s.rows<any>(
      'SELECT lifetime_points AS lifetimePoints,weekly_points AS weeklyPoints,questions_answered AS questionsAnswered,correct_answers AS correctAnswers,games_played AS gamesPlayed,current_streak AS currentStreak,best_streak AS bestStreak,CASE WHEN questions_answered=0 THEN 0 ELSE round(100.0*correct_answers/questions_answered,1) END AS accuracy FROM app_trivia_stats WHERE user_id=?',
      [user],
    );
    return normalizeTriviaStats(row);
  }
}
