import { randomUUID } from 'node:crypto';
import {
  DRILL_PLAY_CLOCK_SECONDS,
  DRILL_QUESTION_COUNT,
  DRILL_YARDS_PER_CORRECT_ANSWER,
} from '@/features/trivia/four-minute-drill';
import type { TriviaAnswerChoice } from '@/features/trivia/types';
import { authDb } from '@/server/auth/database';
import { awardYardsInTransaction } from '@/server/rewards/repository';
import { ensureTriviaQuestionPool } from '@/server/trivia/question-pool';

export async function createTriviaGame(userId: string, teamId: string) {
  await ensureTriviaQuestionPool(teamId, DRILL_QUESTION_COUNT);
  const sql = authDb();
  return sql.begin(async (tx) => {
    const gameId = randomUUID();
    const count = DRILL_QUESTION_COUNT;
    const questions = await tx<
      Array<{ id: string }>
    >`SELECT id FROM trivia_questions WHERE team_id=${teamId} AND active=true AND (verified=true OR ${process.env.NODE_ENV !== 'production'}) ORDER BY md5(id||${gameId}) LIMIT ${count}`;
    if (questions.length < count) throw new Error('Not enough active questions for this team.');
    await tx`INSERT INTO trivia_games(id,mode,team_id,created_by_user_id,question_count,timer_seconds) VALUES(${gameId},'FULL',${teamId},${userId},${count},${DRILL_PLAY_CLOCK_SECONDS})`;
    for (const [index, q] of questions.entries())
      await tx`INSERT INTO trivia_game_questions(game_id,question_id,position) VALUES(${gameId},${q.id},${index + 1})`;
    await tx`INSERT INTO trivia_game_participants(game_id,user_id) VALUES(${gameId},${userId})`;
    return { gameId };
  });
}

export const getGameStandings = (gameId: string) =>
  authDb()`SELECT p.user_id AS "userId",coalesce(u.display_name,'Football Fan') AS name,p.score,p.correct_answers AS "correctAnswers",p.wrong_answers AS "wrongAnswers",p.timeouts,p.response_time_total_ms AS "responseTimeTotalMs",p.best_question_score AS "bestQuestionScore",p.completed_at AS "completedAt",(SELECT rs.rank FROM trivia_rank_snapshots rs WHERE rs.game_id=p.game_id AND rs.user_id=p.user_id ORDER BY rs.question_position DESC LIMIT 1) AS "currentRank",(SELECT rs.rank FROM trivia_rank_snapshots rs WHERE rs.game_id=p.game_id AND rs.user_id=p.user_id ORDER BY rs.question_position DESC OFFSET 1 LIMIT 1) AS "previousRank" FROM trivia_game_participants p JOIN users u ON u.id=p.user_id WHERE p.game_id=${gameId} AND p.participant_status='JOINED' ORDER BY p.score DESC,p.correct_answers DESC,u.display_name,u.id`;

export async function getTriviaGame(userId: string, gameId: string) {
  const sql = authDb();
  const participants = await sql<
    Array<{ score: number; correctAnswers: number }>
  >`SELECT score,correct_answers AS "correctAnswers" FROM trivia_game_participants WHERE game_id=${gameId} AND user_id=${userId}`;
  if (!participants[0]) throw new Error('Game not found.');
  const games = await sql<
    Array<{
      mode: string;
      teamId: string;
      status: string;
      questionCount: number;
      timerSeconds: number;
    }>
  >`SELECT mode,team_id AS "teamId",status,question_count AS "questionCount",timer_seconds AS "timerSeconds" FROM trivia_games WHERE id=${gameId}`;
  const game = games[0];
  if (!game) throw new Error('Game not found.');
  const counts = await sql<
    Array<{ count: number }>
  >`SELECT count(*)::int AS count FROM trivia_answers WHERE game_id=${gameId} AND user_id=${userId}`;
  const position = (counts[0]?.count ?? 0) + 1;
  const standings = await getGameStandings(gameId);
  if (position > game.questionCount || game.status === 'COMPLETED')
    return {
      gameId,
      currentUserId: userId,
      ...game,
      position: game.questionCount,
      score: participants[0].score,
      correctAnswers: participants[0].correctAnswers,
      completed: true,
      question: null,
      standings,
    };
  if (game.mode === 'GROUP' && position > 1) {
    const readiness = await sql<
      Array<{ presentedAt: Date | null; answers: number; participants: number }>
    >`SELECT gq.presented_at AS "presentedAt",(SELECT count(*)::int FROM trivia_answers a WHERE a.game_id=${gameId} AND a.question_id=gq.question_id) AS answers,(SELECT count(*)::int FROM trivia_game_participants p WHERE p.game_id=${gameId} AND p.participant_status='JOINED') AS participants FROM trivia_game_questions gq WHERE gq.game_id=${gameId} AND gq.position=${position - 1}`;
    const state = readiness[0];
    const windowOpen = state?.presentedAt
      ? Date.now() - state.presentedAt.getTime() < game.timerSeconds * 1000
      : false;
    if (state && state.answers < state.participants && windowOpen)
      return {
        gameId,
        currentUserId: userId,
        ...game,
        position: position - 1,
        score: participants[0].score,
        correctAnswers: participants[0].correctAnswers,
        completed: false,
        waitingForPlayers: true,
        question: null,
        standings,
      };
  }
  const initialPresentation =
    game.mode === 'GROUP' && position === 1 ? new Date(Date.now() + 3_000) : new Date();
  await sql`UPDATE trivia_game_questions SET presented_at=coalesce(presented_at,${initialPresentation}) WHERE game_id=${gameId} AND position=${position}`;
  const rows = await sql<
    Array<Record<string, unknown>>
  >`SELECT q.id,q.question,q.answer_a AS "answerA",q.answer_b AS "answerB",q.answer_c AS "answerC",q.answer_d AS "answerD",q.category,gq.presented_at AS "presentedAt" FROM trivia_game_questions gq JOIN trivia_questions q ON q.id=gq.question_id WHERE gq.game_id=${gameId} AND gq.position=${position}`;
  return {
    gameId,
    currentUserId: userId,
    ...game,
    position,
    score: participants[0].score,
    correctAnswers: participants[0].correctAnswers,
    completed: false,
    question: rows[0],
    standings,
  };
}

export async function answerTriviaGameQuestion(
  userId: string,
  gameId: string,
  selectedAnswer: TriviaAnswerChoice | null,
) {
  const sql = authDb();
  return sql.begin(async (tx) => {
    const games = await tx<
      Array<{ questionCount: number; timerSeconds: number; status: string; mode: string }>
    >`SELECT question_count AS "questionCount",timer_seconds AS "timerSeconds",status,mode FROM trivia_games WHERE id=${gameId} FOR UPDATE`;
    const game = games[0];
    if (!game || game.status !== 'ACTIVE')
      throw new Error(
        game?.status === 'WAITING' ? 'The host has not started this game.' : 'Game is not active.',
      );
    const participants = await tx<
      Array<{ score: number }>
    >`SELECT score FROM trivia_game_participants WHERE game_id=${gameId} AND user_id=${userId} FOR UPDATE`;
    if (!participants[0]) throw new Error('You are not a participant.');
    const counts = await tx<
      Array<{ count: number }>
    >`SELECT count(*)::int AS count FROM trivia_answers WHERE game_id=${gameId} AND user_id=${userId}`;
    const position = (counts[0]?.count ?? 0) + 1;
    const questions = await tx<
      Array<{
        id: string;
        correctAnswer: TriviaAnswerChoice;
        explanation: string;
        presentedAt: Date | null;
      }>
    >`SELECT q.id,q.correct_answer AS "correctAnswer",q.explanation,gq.presented_at AS "presentedAt" FROM trivia_game_questions gq JOIN trivia_questions q ON q.id=gq.question_id WHERE gq.game_id=${gameId} AND gq.position=${position}`;
    const question = questions[0];
    if (!question) throw new Error('No question is available.');
    const elapsed = question.presentedAt
      ? Date.now() - question.presentedAt.getTime()
      : game.timerSeconds * 1000;
    const timedOut = elapsed >= game.timerSeconds * 1000;
    const choice = timedOut ? null : selectedAnswer;
    const correct = Boolean(choice && choice === question.correctAnswer);
    const points = correct ? DRILL_YARDS_PER_CORRECT_ANSWER : 0;
    const inserted = await tx<
      Array<{ id: string }>
    >`INSERT INTO trivia_answers(id,user_id,question_id,game_id,selected_answer,correct,response_time_ms,points_awarded) VALUES(${randomUUID()},${userId},${question.id},${gameId},${choice},${correct},${Math.max(0, elapsed)},${points}) ON CONFLICT(user_id,question_id,game_id) DO NOTHING RETURNING id`;
    if (!inserted[0]) throw new Error('Question was already answered.');
    await tx`UPDATE trivia_game_participants SET score=score+${points},correct_answers=correct_answers+${correct ? 1 : 0},wrong_answers=wrong_answers+${!correct && !timedOut ? 1 : 0},timeouts=timeouts+${timedOut ? 1 : 0},response_time_total_ms=response_time_total_ms+${Math.max(0, elapsed)},best_question_score=greatest(best_question_score,${points}) WHERE game_id=${gameId} AND user_id=${userId}`;
    await tx`INSERT INTO trivia_rank_snapshots(game_id,user_id,question_position,rank,score) SELECT ${gameId},ranked.user_id,${position},ranked.rank,ranked.score FROM (SELECT p.user_id,p.score,row_number() OVER(ORDER BY p.score DESC,p.correct_answers DESC,u.display_name,u.id)::int AS rank FROM trivia_game_participants p JOIN users u ON u.id=p.user_id WHERE p.game_id=${gameId} AND p.participant_status='JOINED') ranked ON CONFLICT(game_id,user_id,question_position) DO UPDATE SET rank=EXCLUDED.rank,score=EXCLUDED.score,created_at=now()`;
    await tx`INSERT INTO trivia_stats(user_id,lifetime_points,weekly_points,questions_answered,correct_answers,current_streak,best_streak,response_time_total_ms) VALUES(${userId},${points},${points},1,${correct ? 1 : 0},${correct ? 1 : 0},${correct ? 1 : 0},${Math.max(0, elapsed)}) ON CONFLICT(user_id) DO UPDATE SET lifetime_points=trivia_stats.lifetime_points+${points},weekly_points=trivia_stats.weekly_points+${points},questions_answered=trivia_stats.questions_answered+1,correct_answers=trivia_stats.correct_answers+${correct ? 1 : 0},current_streak=CASE WHEN ${correct} THEN trivia_stats.current_streak+1 ELSE 0 END,best_streak=greatest(trivia_stats.best_streak,CASE WHEN ${correct} THEN trivia_stats.current_streak+1 ELSE trivia_stats.best_streak END),response_time_total_ms=trivia_stats.response_time_total_ms+${Math.max(0, elapsed)},updated_at=now()`;
    let yardAwarded = 0;
    let touchdownsEarned = 0;
    let unlockedRewards: Array<{ id: string; title: string; thresholdYards: number }> = [];
    if (correct) {
      const award = await awardYardsInTransaction(tx, {
        userId,
        action: 'TRIVIA_CORRECT',
        sourceType: 'TRIVIA_QUESTION',
        sourceId: question.id,
      });
      yardAwarded += award.yardsAwarded;
      touchdownsEarned += award.touchdownsEarned;
      unlockedRewards.push(...award.unlockedRewards);
    }
    const completed = position >= game.questionCount;
    if (completed) {
      await tx`UPDATE trivia_game_participants SET completed_at=now() WHERE game_id=${gameId} AND user_id=${userId}`;
      const pending = await tx<
        Array<{ count: number }>
      >`SELECT count(*)::int AS count FROM trivia_game_participants WHERE game_id=${gameId} AND completed_at IS NULL`;
      if ((pending[0]?.count ?? 0) === 0)
        await tx`UPDATE trivia_games SET status='COMPLETED',completed_at=now() WHERE id=${gameId}`;
      await tx`UPDATE trivia_stats SET games_played=games_played+1,best_game_score=greatest(best_game_score,(SELECT score FROM trivia_game_participants WHERE game_id=${gameId} AND user_id=${userId})) WHERE user_id=${userId}`;
      if (game.questionCount === 10) {
        const award = await awardYardsInTransaction(tx, {
          userId,
          action: 'TRIVIA_GAME_COMPLETE',
          sourceType: 'TRIVIA_GAME',
          sourceId: gameId,
        });
        yardAwarded += award.yardsAwarded;
        touchdownsEarned += award.touchdownsEarned;
        unlockedRewards.push(...award.unlockedRewards);
      }
      if (
        (pending[0]?.count ?? 0) === 0 &&
        (game.mode === 'FRIEND_CHALLENGE' || game.mode === 'GROUP')
      ) {
        const winners = await tx<
          Array<{ userId: string }>
        >`SELECT user_id AS "userId" FROM trivia_game_participants WHERE game_id=${gameId} AND participant_status='JOINED' ORDER BY score DESC,correct_answers DESC,response_time_total_ms ASC,user_id LIMIT 1`;
        if (winners[0]) {
          const award = await awardYardsInTransaction(tx, {
            userId: winners[0].userId,
            action: 'TRIVIA_BUDDY_WIN',
            sourceType: 'TRIVIA_GAME',
            sourceId: gameId,
          });
          if (winners[0].userId === userId) {
            yardAwarded += award.yardsAwarded;
            touchdownsEarned += award.touchdownsEarned;
            unlockedRewards.push(...award.unlockedRewards);
          }
        }
      }
    }
    return {
      correct,
      points,
      selectedAnswer: choice,
      correctAnswer: question.correctAnswer,
      explanation: question.explanation,
      responseTimeMs: Math.max(0, elapsed),
      timedOut,
      yardAwarded,
      touchdownsEarned,
      unlockedRewards,
      completed,
      position,
    };
  });
}

export async function getTriviaLeaderboard(
  scope: 'GLOBAL' | 'TEAM',
  teamId: string | null,
  period: 'WEEK' | 'ALL_TIME',
  limit = 25,
) {
  const points = period === 'WEEK' ? 'weekly_points' : 'lifetime_points';
  const teamJoin =
    scope === 'TEAM'
      ? `JOIN user_team_follows f ON f.user_id=u.id AND f.is_primary=true AND f.team_id=$1`
      : '';
  const params = scope === 'TEAM' ? [teamId] : [];
  return authDb().unsafe(
    `SELECT row_number() OVER(ORDER BY s.${points} DESC,s.correct_answers DESC,u.id)::int AS rank,u.id AS "userId",coalesce(u.display_name,'Football Fan') AS name,s.${points} AS score,CASE WHEN s.questions_answered=0 THEN 0 ELSE round(s.correct_answers::numeric/s.questions_answered*100,1) END AS accuracy,s.games_played AS "gamesPlayed" FROM trivia_stats s JOIN users u ON u.id=s.user_id ${teamJoin} WHERE u.is_guest=false ORDER BY s.${points} DESC,s.correct_answers DESC,u.id LIMIT ${Math.min(100, Math.max(1, limit))}`,
    params,
  );
}
