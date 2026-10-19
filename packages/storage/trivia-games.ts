import { createHash, randomBytes } from 'node:crypto';
import { Storage, type Statement } from './core';
import { guardedBatch, iso } from './atomic';
import { planRewardBatch } from './reward-batch';
import { TRIVIA_QUESTION_BANK } from '../../src/features/trivia/question-bank';
import {
  DRILL_QUESTION_COUNT,
  DRILL_PLAY_CLOCK_SECONDS,
  getDrillYards,
} from '../../src/features/trivia/four-minute-drill';
import { MAX_BUDDY_PLAYERS } from '../../src/features/trivia/experience';
import type { TriviaAnswerChoice, TriviaMode } from '../../src/features/trivia/types';
import type { RewardActionType } from '../../src/features/rewards/config';
const hash = (s: string) => createHash('sha256').update(s).digest('hex');
export class D1TriviaGames {
  constructor(readonly s: Storage) {}
  async ensureTriviaQuestionPool(team: string, minimum: number) {
    team = team.toUpperCase();
    const [n] = await this.s.rows<any>(
      'SELECT count(*) AS n FROM app_trivia_questions WHERE team_id=? AND active=1 AND verified=1',
      [team],
    );
    if (n.n >= minimum) return;
    const questions = TRIVIA_QUESTION_BANK.filter((q) => q.teamId === team && q.active).slice(
      0,
      minimum,
    );
    if (questions.length < minimum) throw Error('Not enough active questions.');
    const now = Date.now();
    await this.s.batch(
      questions
        .filter((q) => q.correctAnswer)
        .map((q) =>
          this.s.statement(
            'INSERT INTO app_trivia_questions(id,team_id,question,answer_a,answer_b,answer_c,answer_d,correct_answer,explanation,category,source_note,verified,active,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,1,1,?,?) ON CONFLICT(id) DO UPDATE SET active=1,verified=1,updated_at=excluded.updated_at',
            [
              q.id,
              team,
              q.question,
              q.answers.A,
              q.answers.B,
              q.answers.C,
              q.answers.D,
              q.correctAnswer,
              q.explanation,
              q.category,
              'Bundled baseline question used when production seed data is unavailable.',
              now,
              now,
            ],
          ),
        ),
    );
  }
  async selected(team: string, id: string, count = DRILL_QUESTION_COUNT) {
    await this.ensureTriviaQuestionPool(team, count);
    const rows = await this.s.rows<any>(
      'SELECT id FROM app_trivia_questions WHERE team_id=? AND active=1 AND (verified=1 OR ?=1)',
      [team, process.env.NODE_ENV === 'production' ? 0 : 1],
    );
    rows.sort((a, b) =>
      createHash('md5')
        .update(a.id + id)
        .digest('hex')
        .localeCompare(
          createHash('md5')
            .update(b.id + id)
            .digest('hex'),
        ),
    );
    if (rows.length < count) throw Error('Not enough active questions.');
    return rows.slice(0, count).map((q) => q.id as string);
  }
  gameWrites(
    id: string,
    user: string,
    team: string,
    mode: string,
    questions: string[],
    status = 'ACTIVE',
  ) {
    const now = Date.now();
    return [
      this.s.statement(
        'INSERT INTO app_trivia_games(id,mode,team_id,status,created_by_user_id,question_count,timer_seconds,created_at,started_at) VALUES(?,?,?,?,?,?,?,?,?)',
        [id, mode, team, status, user, questions.length, DRILL_PLAY_CLOCK_SECONDS, now, now],
      ),
      this.s.statement(
        'INSERT INTO app_trivia_game_questions(game_id,question_id,position) SELECT ?,value,CAST(key AS INTEGER)+1 FROM json_each(?)',
        [id, JSON.stringify(questions)],
      ),
      this.s.statement('INSERT INTO app_trivia_game_participants(game_id,user_id) VALUES(?,?)', [
        id,
        user,
      ]),
    ];
  }
  async createTriviaGame(user: string, team: string) {
    const gameId = crypto.randomUUID(),
      questions = await this.selected(team, gameId);
    await this.s.batch(this.gameWrites(gameId, user, team, 'FULL', questions));
    return { gameId };
  }
  async startTriviaGame(user: string, mode: TriviaMode, team: string, questionIds: string[]) {
    if (![5, 10].includes(questionIds.length) || new Set(questionIds).size !== questionIds.length)
      throw Error('Invalid question set');
    const gameId = crypto.randomUUID();
    await guardedBatch(
      this.s,
      [
        {
          sql: '(SELECT count(*) FROM app_trivia_questions WHERE id IN(SELECT value FROM json_each(?)) AND team_id=? AND active=1 AND (verified=1 OR ?=1))=?',
          values: [
            JSON.stringify(questionIds),
            team,
            process.env.NODE_ENV === 'production' ? 0 : 1,
            questionIds.length,
          ],
        },
      ],
      this.gameWrites(gameId, user, team, mode, questionIds),
    );
    return { gameId };
  }
  async getGameStandings(game: string) {
    return (
      await this.s.rows<any>(
        "SELECT p.user_id AS userId,coalesce(u.display_name,'Football Fan') AS name,u.avatar_url AS avatarUrl,f.team_id AS teamId,p.score,p.correct_answers AS correctAnswers,p.wrong_answers AS wrongAnswers,p.timeouts,p.response_time_total_ms AS responseTimeTotalMs,p.best_question_score AS bestQuestionScore,p.completed_at AS completedAt,(SELECT rank FROM app_trivia_rank_snapshots r WHERE r.game_id=p.game_id AND r.user_id=p.user_id ORDER BY question_position DESC LIMIT 1) AS currentRank,(SELECT rank FROM app_trivia_rank_snapshots r WHERE r.game_id=p.game_id AND r.user_id=p.user_id ORDER BY question_position DESC LIMIT 1 OFFSET 1) AS previousRank FROM app_trivia_game_participants p JOIN app_users u ON u.id=p.user_id LEFT JOIN app_team_follows f ON f.user_id=u.id AND f.is_primary=1 WHERE p.game_id=? AND p.participant_status='JOINED' ORDER BY p.score DESC,p.correct_answers DESC,p.response_time_total_ms,u.display_name,u.id",
        [game],
      )
    ).map((p) => ({ ...p, completedAt: p.completedAt == null ? null : new Date(p.completedAt) }));
  }
  async getTriviaGame(user: string, gameId: string) {
    const [participant] = await this.s.rows<any>(
        'SELECT * FROM app_trivia_game_participants WHERE game_id=? AND user_id=?',
        [gameId, user],
      ),
      [r] = await this.s.rows<any>('SELECT * FROM app_trivia_games WHERE id=?', [gameId]);
    if (!participant || !r) throw Error('Game not found.');
    const [n] = await this.s.rows<any>(
        'SELECT count(*) AS n FROM app_trivia_game_answers WHERE game_id=? AND user_id=?',
        [gameId, user],
      ),
      position = n.n + 1,
      game = {
        mode: r.mode,
        teamId: r.team_id,
        status: r.status,
        questionCount: r.question_count,
        timerSeconds: r.timer_seconds,
      },
      standings = await this.getGameStandings(gameId),
      base = {
        gameId,
        currentUserId: user,
        ...game,
        position,
        score: participant.score,
        correctAnswers: participant.correct_answers,
        completed: false,
        standings,
      };
    if (position > r.question_count || r.status === 'COMPLETED')
      return { ...base, position: r.question_count, completed: true, question: null };
    if (r.status === 'WAITING') return { ...base, waitingForPlayers: true, question: null };
    if (r.mode === 'GROUP' && position > 1) {
      const [prev] = await this.s.rows<any>(
        "SELECT q.presented_at,(SELECT count(*) FROM app_trivia_game_answers a WHERE a.game_id=q.game_id AND a.question_id=q.question_id) AS answers,(SELECT count(*) FROM app_trivia_game_participants p WHERE p.game_id=q.game_id AND p.participant_status='JOINED') AS players FROM app_trivia_game_questions q WHERE q.game_id=? AND q.position=?",
        [gameId, position - 1],
      );
      if (
        prev &&
        prev.answers < prev.players &&
        prev.presented_at != null &&
        Date.now() - prev.presented_at < r.timer_seconds * 1000
      )
        return { ...base, position: position - 1, waitingForPlayers: true, question: null };
    }
    await this.s
      .statement(
        'UPDATE app_trivia_game_questions SET presented_at=coalesce(presented_at,?) WHERE game_id=? AND position=?',
        [Date.now() + (r.mode === 'GROUP' && position === 1 ? 3000 : 0), gameId, position],
      )
      .run();
    const [q] = await this.s.rows<any>(
      'SELECT q.id,q.question,q.answer_a AS answerA,q.answer_b AS answerB,q.answer_c AS answerC,q.answer_d AS answerD,q.category,g.presented_at AS presentedAt FROM app_trivia_game_questions g JOIN app_trivia_questions q ON q.id=g.question_id WHERE g.game_id=? AND g.position=?',
      [gameId, position],
    );
    return { ...base, question: q ? { ...q, presentedAt: new Date(q.presentedAt) } : null };
  }
  async answerTriviaGameQuestion(
    user: string,
    gameId: string,
    selected: TriviaAnswerChoice | null,
  ) {
    if (selected !== null && !['A', 'B', 'C', 'D'].includes(selected))
      throw Error('Invalid answer');
    const [initial] = await this.s.rows<any>(
      'SELECT count(*) AS n FROM app_trivia_game_answers WHERE game_id=? AND user_id=?',
      [gameId, user],
    );
    for (let attempt = 0; attempt < 4; attempt++) {
      const [game] = await this.s.rows<any>('SELECT * FROM app_trivia_games WHERE id=?', [gameId]),
        players = await this.s.rows<any>(
          'SELECT * FROM app_trivia_game_participants WHERE game_id=?',
          [gameId],
        ),
        player = players.find((p) => p.user_id === user),
        [count] = await this.s.rows<any>(
          'SELECT count(*) AS n FROM app_trivia_game_answers WHERE game_id=? AND user_id=?',
          [gameId, user],
        );
      if (!game || game.status !== 'ACTIVE') throw Error('Game is not active.');
      if (!player || player.participant_status !== 'JOINED')
        throw Error('You are not a participant.');
      if (count.n !== initial.n) throw Error('Question was already answered.');
      const position = count.n + 1,
        [q] = await this.s.rows<any>(
          'SELECT q.id,q.correct_answer,q.explanation,g.presented_at FROM app_trivia_game_questions g JOIN app_trivia_questions q ON q.id=g.question_id WHERE g.game_id=? AND g.position=?',
          [gameId, position],
        );
      if (!q || q.presented_at == null) throw Error('No presented question is available.');
      const now = Date.now();
      if (q.presented_at > now) throw Error('Question has not started yet.');
      const timedOut = now - q.presented_at >= game.timer_seconds * 1000,
        responseTimeMs = Math.min(game.timer_seconds * 1000, Math.max(0, now - q.presented_at)),
        choice = timedOut ? null : selected,
        correct = Boolean(choice && choice === q.correct_answer),
        points = getDrillYards(correct),
        completed = position >= game.question_count,
        last = completed && players.every((p) => p.user_id === user || p.completed_at != null);
      const awards: {
        userId: string;
        action: RewardActionType;
        sourceType: string;
        sourceId: string;
      }[] = [];
      if (correct)
        awards.push({
          userId: user,
          action: 'TRIVIA_CORRECT',
          sourceType: 'TRIVIA_QUESTION',
          sourceId: q.id,
        });
      if (completed && game.question_count === 10)
        awards.push({
          userId: user,
          action: 'TRIVIA_GAME_COMPLETE',
          sourceType: 'TRIVIA_GAME',
          sourceId: gameId,
        });
      if (last && ['GROUP', 'FRIEND_CHALLENGE'].includes(game.mode)) {
        const ranked = players
          .filter((p) => p.participant_status === 'JOINED')
          .map((p) => ({
            ...p,
            score: p.score + (p.user_id === user ? points : 0),
            correct_answers: p.correct_answers + (p.user_id === user && correct ? 1 : 0),
            response_time_total_ms:
              p.response_time_total_ms + (p.user_id === user ? responseTimeMs : 0),
          }))
          .sort(
            (a, b) =>
              b.score - a.score ||
              b.correct_answers - a.correct_answers ||
              a.response_time_total_ms - b.response_time_total_ms ||
              a.user_id.localeCompare(b.user_id),
          );
        if (ranked[0])
          awards.push({
            userId: ranked[0].user_id,
            action: 'TRIVIA_BUDDY_WIN',
            sourceType: 'TRIVIA_GAME',
            sourceId: gameId,
          });
      }
      const reward = await planRewardBatch(this.s, awards),
        writes: Statement[] = [
          this.s.statement(
            'INSERT INTO app_trivia_game_answers(id,user_id,question_id,game_id,selected_answer,correct,response_time_ms,points_awarded,answered_at) VALUES(?,?,?,?,?,?,?,?,?)',
            [
              crypto.randomUUID(),
              user,
              q.id,
              gameId,
              choice,
              correct ? 1 : 0,
              responseTimeMs,
              points,
              now,
            ],
          ),
          this.s.statement(
            'UPDATE app_trivia_game_participants SET score=score+?,correct_answers=correct_answers+?,wrong_answers=wrong_answers+?,timeouts=timeouts+?,response_time_total_ms=response_time_total_ms+?,best_question_score=max(best_question_score,?),completed_at=CASE WHEN ? THEN ? ELSE completed_at END WHERE game_id=? AND user_id=?',
            [
              points,
              correct ? 1 : 0,
              !correct && !timedOut ? 1 : 0,
              timedOut ? 1 : 0,
              responseTimeMs,
              points,
              completed ? 1 : 0,
              now,
              gameId,
              user,
            ],
          ),
          this.s.statement(
            "INSERT INTO app_trivia_rank_snapshots(game_id,user_id,question_position,rank,score,created_at) SELECT ?,p.user_id,?,row_number() OVER(ORDER BY p.score DESC,p.correct_answers DESC,u.display_name,u.id),p.score,? FROM app_trivia_game_participants p JOIN app_users u ON u.id=p.user_id WHERE p.game_id=? AND p.participant_status='JOINED' ON CONFLICT(game_id,user_id,question_position) DO UPDATE SET rank=excluded.rank,score=excluded.score,created_at=excluded.created_at",
            [gameId, position, now, gameId],
          ),
          this.s.statement(
            'INSERT INTO app_trivia_stats(user_id,lifetime_points,weekly_points,questions_answered,correct_answers,current_streak,best_streak,response_time_total_ms,updated_at) VALUES(?,?,?,1,?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET lifetime_points=lifetime_points+excluded.lifetime_points,weekly_points=weekly_points+excluded.weekly_points,questions_answered=questions_answered+1,correct_answers=correct_answers+excluded.correct_answers,current_streak=CASE WHEN ? THEN current_streak+1 ELSE 0 END,best_streak=max(best_streak,CASE WHEN ? THEN current_streak+1 ELSE best_streak END),response_time_total_ms=response_time_total_ms+excluded.response_time_total_ms,updated_at=excluded.updated_at',
            [
              user,
              points,
              points,
              correct ? 1 : 0,
              correct ? 1 : 0,
              correct ? 1 : 0,
              responseTimeMs,
              now,
              correct ? 1 : 0,
              correct ? 1 : 0,
            ],
          ),
          this.s.statement(
            "UPDATE app_trivia_games SET version=version+1,status=CASE WHEN ? THEN 'COMPLETED' ELSE status END,completed_at=CASE WHEN ? THEN ? ELSE completed_at END WHERE id=?",
            [last ? 1 : 0, last ? 1 : 0, now, gameId],
          ),
          ...reward.statements,
        ];
      if (completed)
        writes.push(
          this.s.statement(
            'UPDATE app_trivia_stats SET games_played=games_played+1,best_game_score=max(best_game_score,(SELECT score FROM app_trivia_game_participants WHERE game_id=? AND user_id=?)) WHERE user_id=?',
            [gameId, user, user],
          ),
        );
      try {
        await guardedBatch(
          this.s,
          [
            {
              sql: "EXISTS(SELECT 1 FROM app_trivia_games WHERE id=? AND status='ACTIVE' AND version=?)",
              values: [gameId, game.version],
            },
            {
              sql: '(SELECT count(*) FROM app_trivia_game_answers WHERE game_id=? AND user_id=?)=? AND EXISTS(SELECT 1 FROM app_trivia_game_questions WHERE game_id=? AND question_id=? AND presented_at=?)',
              values: [gameId, user, initial.n, gameId, q.id, q.presented_at],
            },
          ],
          writes,
          'Trivia state changed; retry.',
        );
        const mine = reward.results.get(user);
        return {
          correct,
          points,
          selectedAnswer: choice,
          correctAnswer: q.correct_answer as TriviaAnswerChoice,
          explanation: q.explanation,
          responseTimeMs,
          timedOut,
          yardAwarded: mine?.yardsAwarded ?? 0,
          touchdownsEarned: mine?.touchdownsEarned ?? 0,
          unlockedRewards: mine?.unlockedRewards ?? [],
          completed,
          position,
        };
      } catch (error) {
        if (attempt === 3 || !/Trivia state changed|CHECK constraint failed/.test(String(error)))
          throw error;
      }
    }
    throw Error('Trivia state changed; retry.');
  }
  async getTriviaLeaderboard(
    scope: 'GLOBAL' | 'TEAM',
    team: string | null,
    period: 'WEEK' | 'ALL_TIME',
    limit = 25,
  ) {
    const column = period === 'WEEK' ? 'weekly_points' : 'lifetime_points';
    return this.s.rows<any>(
      `SELECT row_number() OVER(ORDER BY s.${column} DESC,s.correct_answers DESC,u.id) AS rank,u.id AS userId,coalesce(u.display_name,'Football Fan') AS name,s.${column} AS score,CASE WHEN s.questions_answered=0 THEN 0 ELSE round(s.correct_answers*100.0/s.questions_answered,1) END AS accuracy,s.games_played AS gamesPlayed FROM app_trivia_stats s JOIN app_users u ON u.id=s.user_id ${scope === 'TEAM' ? 'JOIN app_team_follows f ON f.user_id=u.id AND f.is_primary=1 AND f.team_id=?' : ''} WHERE u.is_guest=0 ORDER BY s.${column} DESC,s.correct_answers DESC,u.id LIMIT ?`,
      scope === 'TEAM'
        ? [team, Math.min(100, Math.max(1, limit))]
        : [Math.min(100, Math.max(1, limit))],
    );
  }
  async getTriviaLiveState(user: string, game: string) {
    const [m] = await this.s.rows<any>(
      "SELECT 1 FROM app_trivia_game_participants WHERE game_id=? AND user_id=? AND participant_status='JOINED'",
      [game, user],
    );
    if (!m) throw Error('Game not found.');
    const [standings, activity] = await Promise.all([
      this.getGameStandings(game),
      this.s.rows<any>(
        "SELECT a.id,a.answered_at AS at,coalesce(u.display_name,'Football Fan') AS name,a.correct,a.points_awarded AS points,q.position FROM app_trivia_game_answers a JOIN app_users u ON u.id=a.user_id JOIN app_trivia_game_questions q ON q.game_id=a.game_id AND q.question_id=a.question_id WHERE a.game_id=? ORDER BY a.answered_at DESC,a.id LIMIT 5",
        [game],
      ),
    ]);
    return {
      standings,
      activity: activity.map((a) => ({ ...a, at: new Date(a.at), correct: Boolean(a.correct) })),
    };
  }
  async searchUsers(user: string, query: string) {
    return this.s.rows<any>(
      "SELECT id,display_name AS displayName,avatar_url AS avatarUrl FROM app_users WHERE id<>? AND status='ACTIVE' AND display_name LIKE ? ORDER BY display_name LIMIT 20",
      [user, '%' + query + '%'],
    );
  }
  async listFriends(user: string) {
    return (
      await this.s.rows<any>(
        'SELECT f.requester_user_id AS requesterUserId,f.addressee_user_id AS addresseeUserId,f.status,f.created_at AS createdAt,f.accepted_at AS acceptedAt,u.id AS userId,u.display_name AS displayName FROM app_trivia_friendships f JOIN app_users u ON u.id=CASE WHEN f.requester_user_id=? THEN f.addressee_user_id ELSE f.requester_user_id END WHERE f.requester_user_id=? OR f.addressee_user_id=? ORDER BY f.created_at DESC',
        [user, user, user],
      )
    ).map((r) => ({
      ...r,
      createdAt: new Date(r.createdAt),
      acceptedAt: r.acceptedAt == null ? null : new Date(r.acceptedAt),
    }));
  }
  async requestFriend(user: string, other: string) {
    if (user === other) throw Error('You cannot add yourself.');
    await this.s
      .statement(
        "INSERT INTO app_trivia_friendships(requester_user_id,addressee_user_id,status,created_at) VALUES(?,?,'PENDING',?) ON CONFLICT DO NOTHING",
        [user, other, Date.now()],
      )
      .run();
    return this.listFriends(user);
  }
  async acceptFriend(user: string, other: string) {
    const rows = await this.s.rows<any>(
      "UPDATE app_trivia_friendships SET status='ACCEPTED',accepted_at=? WHERE requester_user_id=? AND addressee_user_id=? AND status='PENDING' RETURNING requester_user_id",
      [Date.now(), other, user],
    );
    if (!rows.length) throw Error('Friend request not found.');
    return this.listFriends(user);
  }
  async removeFriend(user: string, other: string) {
    await this.s
      .statement(
        'DELETE FROM app_trivia_friendships WHERE (requester_user_id=? AND addressee_user_id=?) OR(requester_user_id=? AND addressee_user_id=?)',
        [user, other, other, user],
      )
      .run();
  }
  async createChallenge(user: string, other: string, team: string, _count: 5 | 10) {
    const gameId = crypto.randomUUID(),
      id = crypto.randomUUID(),
      questions = await this.selected(team, gameId),
      now = Date.now();
    await this.s.batch([
      ...this.gameWrites(gameId, user, team, 'FRIEND_CHALLENGE', questions),
      this.s.statement(
        'INSERT INTO app_trivia_game_participants(game_id,user_id) VALUES(?,?) ON CONFLICT DO NOTHING',
        [gameId, other],
      ),
      this.s.statement(
        'INSERT INTO app_trivia_challenges(id,challenger_user_id,challenged_user_id,game_id,created_at,expires_at) VALUES(?,?,?,?,?,?)',
        [id, user, other, gameId, now, now + 7 * 86400000],
      ),
    ]);
    return { id, gameId };
  }
  async listChallenges(user: string) {
    return (
      await this.s.rows<any>(
        'SELECT c.id,c.challenger_user_id AS challengerUserId,c.challenged_user_id AS challengedUserId,c.game_id AS gameId,c.status,c.expires_at AS expiresAt,g.team_id AS teamId,g.question_count AS questionCount FROM app_trivia_challenges c JOIN app_trivia_games g ON g.id=c.game_id WHERE c.challenger_user_id=? OR c.challenged_user_id=? ORDER BY c.created_at DESC',
        [user, user],
      )
    ).map((r) => ({ ...r, expiresAt: new Date(r.expiresAt) }));
  }
  async acceptChallenge(user: string, id: string) {
    const [c] = await this.s.rows<any>('SELECT game_id FROM app_trivia_challenges WHERE id=?', [
      id,
    ]);
    if (!c) throw Error('Challenge is unavailable.');
    await guardedBatch(
      this.s,
      [
        {
          sql: "EXISTS(SELECT 1 FROM app_trivia_challenges WHERE id=? AND challenged_user_id=? AND status='PENDING' AND expires_at>?)",
          values: [id, user, Date.now()],
        },
      ],
      [
        this.s.statement("UPDATE app_trivia_challenges SET status='ACCEPTED' WHERE id=?", [id]),
        this.s.statement(
          'INSERT INTO app_trivia_game_participants(game_id,user_id) VALUES(?,?) ON CONFLICT DO NOTHING',
          [c.game_id, user],
        ),
      ],
    );
    return { gameId: c.game_id as string };
  }
  async createGroup(user: string, team: string) {
    const gameId = crypto.randomUUID(),
      id = crypto.randomUUID(),
      inviteToken = randomBytes(24).toString('base64url'),
      questions = await this.selected(team, gameId),
      now = Date.now();
    for (let attempt = 0; attempt < 5; attempt++) {
      const joinCode = `DND-${String(randomBytes(2).readUInt16BE() % 10000).padStart(4, '0')}`;
      try {
        await this.s.batch([
          ...this.gameWrites(gameId, user, team, 'GROUP', questions, 'WAITING'),
          this.s.statement(
            'INSERT INTO app_trivia_groups(id,game_id,join_code,host_user_id,invite_token_hash,expires_at,created_at) VALUES(?,?,?,?,?,?,?)',
            [id, gameId, joinCode, user, hash(inviteToken), now + 86400000, now],
          ),
          this.s.statement(
            'INSERT INTO app_trivia_invitations(id,game_id,inviter_user_id,invite_token_hash,expires_at,created_at) VALUES(?,?,?,?,?,?)',
            [crypto.randomUUID(), gameId, user, hash(inviteToken), now + 86400000, now],
          ),
        ]);
        return { gameId, joinCode, inviteToken };
      } catch (error) {
        if (attempt === 4 || !String(error).includes('join_code')) throw error;
      }
    }
    throw Error('Unable to create join code.');
  }
  async joinGroup(user: string, code: string) {
    return this.joinGroupWhere(user, 'join_code', code.toUpperCase());
  }
  async joinGroupByToken(user: string, token: string) {
    return this.joinGroupWhere(user, 'invite_token_hash', hash(token));
  }
  private async joinGroupWhere(
    user: string,
    column: 'join_code' | 'invite_token_hash',
    value: string,
  ) {
    const [r] = await this.s.rows<any>(
      `SELECT g.game_id,g.id FROM app_trivia_groups g WHERE ${column}=? AND expires_at>?`,
      [value, Date.now()],
    );
    if (!r) throw Error('Trivia room not found or invitation expired.');
    const prior = await this.s.rows<any>(
        'SELECT 1 FROM app_trivia_game_participants WHERE game_id=? AND user_id=?',
        [r.game_id, user],
      ),
      now = Date.now();
    await guardedBatch(
      this.s,
      [
        {
          sql: "EXISTS(SELECT 1 FROM app_trivia_groups g JOIN app_trivia_games t ON t.id=g.game_id WHERE g.id=? AND g.expires_at>? AND t.status='WAITING')",
          values: [r.id, now],
        },
        {
          sql: 'EXISTS(SELECT 1 FROM app_trivia_game_participants WHERE game_id=? AND user_id=?) OR (SELECT count(*) FROM app_trivia_game_participants WHERE game_id=?)<?',
          values: [r.game_id, user, r.game_id, MAX_BUDDY_PLAYERS],
        },
      ],
      [
        this.s.statement(
          "INSERT INTO app_trivia_game_participants(game_id,user_id) VALUES(?,?) ON CONFLICT(game_id,user_id) DO UPDATE SET participant_status='JOINED'",
          [r.game_id, user],
        ),
        this.s.statement(
          'UPDATE app_trivia_invitations SET accepted_at=coalesce(accepted_at,?),invited_user_id=coalesce(invited_user_id,?) WHERE game_id=?',
          [now, user, r.game_id],
        ),
      ],
    );
    return { gameId: r.game_id as string, joined: !prior.length };
  }
  async startGroup(user: string, code: string) {
    const [r] = await this.s.rows<any>(
      'SELECT game_id,id FROM app_trivia_groups WHERE join_code=? AND host_user_id=?',
      [code.toUpperCase(), user],
    );
    if (!r) throw Error('Only the host can start this group.');
    const now = Date.now();
    await guardedBatch(
      this.s,
      [
        {
          sql: "EXISTS(SELECT 1 FROM app_trivia_games WHERE id=? AND status='WAITING') AND (SELECT count(*) FROM app_trivia_game_participants WHERE game_id=? AND participant_status='JOINED')>=2",
          values: [r.game_id, r.game_id],
        },
      ],
      [
        this.s.statement(
          "DELETE FROM app_trivia_game_participants WHERE game_id=? AND participant_status='INVITED'",
          [r.game_id],
        ),
        this.s.statement(
          "INSERT INTO app_trivia_rank_snapshots(game_id,user_id,question_position,rank,score,created_at) SELECT ?,p.user_id,0,row_number() OVER(ORDER BY u.display_name,u.id),0,? FROM app_trivia_game_participants p JOIN app_users u ON u.id=p.user_id WHERE p.game_id=? AND p.participant_status='JOINED' ON CONFLICT DO NOTHING",
          [r.game_id, now, r.game_id],
        ),
        this.s.statement(
          "UPDATE app_trivia_games SET status='ACTIVE',started_at=?,version=version+1 WHERE id=?",
          [now, r.game_id],
        ),
      ],
      'At least two players are required in a waiting game.',
    );
    return { gameId: r.game_id as string };
  }
  async getGroupRoom(user: string, code: string) {
    return this.groupRoom(user, 'join_code', code.toUpperCase());
  }
  async getGroupRoomByToken(user: string, token: string) {
    return this.groupRoom(user, 'invite_token_hash', hash(token));
  }
  private async groupRoom(user: string, column: 'join_code' | 'invite_token_hash', value: string) {
    const [r] = await this.s.rows<any>(
      `SELECT g.game_id AS gameId,g.join_code AS joinCode,g.host_user_id AS hostUserId,t.status,t.team_id AS teamId FROM app_trivia_groups g JOIN app_trivia_games t ON t.id=g.game_id WHERE g.${column}=? AND g.expires_at>?`,
      [value, Date.now()],
    );
    if (!r) throw Error('Trivia invitation is invalid or expired.');
    const participants = await this.s.rows<any>(
      "SELECT u.id,coalesce(u.display_name,'Football Fan') AS name,p.participant_status AS status,p.score,p.correct_answers AS correctAnswers,p.wrong_answers AS wrongAnswers,p.timeouts,p.response_time_total_ms AS responseTimeTotalMs,p.best_question_score AS bestQuestionScore FROM app_trivia_game_participants p JOIN app_users u ON u.id=p.user_id WHERE p.game_id=? ORDER BY p.score DESC,p.correct_answers DESC,u.display_name,u.id",
      [r.gameId],
    );
    return { ...r, isHost: r.hostUserId === user, participants };
  }
  async inviteUserToGroup(user: string, code: string, other: string) {
    const [r] = await this.s.rows<any>(
      'SELECT game_id,id FROM app_trivia_groups WHERE join_code=? AND host_user_id=?',
      [code.toUpperCase(), user],
    );
    if (!r) throw Error('Only the host can invite buddies to this room.');
    await guardedBatch(
      this.s,
      [
        {
          sql: "EXISTS(SELECT 1 FROM app_trivia_groups g JOIN app_trivia_games t ON t.id=g.game_id WHERE g.id=? AND g.expires_at>? AND t.status='WAITING') AND (SELECT count(*) FROM app_trivia_game_participants WHERE game_id=?)<?",
          values: [r.id, Date.now(), r.game_id, MAX_BUDDY_PLAYERS],
        },
      ],
      [
        this.s.statement(
          "INSERT INTO app_trivia_game_participants(game_id,user_id,participant_status) VALUES(?,?,'INVITED') ON CONFLICT DO NOTHING",
          [r.game_id, other],
        ),
      ],
    );
    return { gameId: r.game_id as string };
  }
  async createGroupRematch(user: string, game: string) {
    const [g] = await this.s.rows<any>(
      "SELECT team_id FROM app_trivia_games WHERE id=? AND created_by_user_id=? AND mode='GROUP'",
      [game, user],
    );
    if (!g) throw Error('Only the host can run this game back.');
    const players = await this.s.rows<any>(
        'SELECT user_id FROM app_trivia_game_participants WHERE game_id=? AND user_id<>? LIMIT ?',
        [game, user, MAX_BUDDY_PLAYERS - 1],
      ),
      room = await this.createGroup(user, g.team_id);
    await this.s
      .statement(
        "INSERT INTO app_trivia_game_participants(game_id,user_id,participant_status) SELECT ?,value,'INVITED' FROM json_each(?) ON CONFLICT DO NOTHING",
        [room.gameId, JSON.stringify(players.map((p) => p.user_id))],
      )
      .run();
    return room;
  }
  async nextTriviaEvent(team: string, user?: string) {
    const now = Date.now(),
      [r] = await this.s.rows<any>(
        "SELECT e.*,(SELECT count(*) FROM app_trivia_event_registrations r WHERE r.event_id=e.id) AS count,EXISTS(SELECT 1 FROM app_trivia_event_registrations r WHERE r.event_id=e.id AND r.user_id=?) AS registered FROM app_trivia_events e WHERE e.team_id=? AND e.status IN('SCHEDULED','LIVE') AND e.ends_at>? ORDER BY CASE WHEN e.status='LIVE' OR e.starts_at<=? THEN 0 ELSE 1 END,e.starts_at LIMIT 1",
        [user ?? null, team, now, now],
      );
    return r
      ? {
          id: r.id,
          teamId: r.team_id,
          startsAt: iso(r.starts_at)!,
          endsAt: iso(r.ends_at)!,
          timezone: r.timezone,
          status: r.status,
          registrationCount: r.count,
          registered: Boolean(r.registered),
        }
      : null;
  }
  async registerTriviaEvent(event: string, user: string, join = false) {
    const [e] = await this.s.rows<any>('SELECT * FROM app_trivia_events WHERE id=?', [event]),
      now = Date.now();
    if (!e || e.status === 'COMPLETED' || e.ends_at <= now)
      throw Error('This event is no longer available.');
    if (join && e.status !== 'LIVE' && e.starts_at > now)
      throw Error('This event has not started yet.');
    const [prior] = await this.s.rows<any>(
      'SELECT game_id FROM app_trivia_event_registrations WHERE event_id=? AND user_id=?',
      [event, user],
    );
    if (join && prior?.game_id) return { gameId: prior.game_id as string };
    const guards = [
        {
          sql: "EXISTS(SELECT 1 FROM app_trivia_events WHERE id=? AND status<>'COMPLETED' AND ends_at>? AND (?=0 OR status='LIVE' OR starts_at<=?))",
          values: [event, now, join ? 1 : 0, now],
        },
      ],
      writes = [
        this.s.statement(
          'INSERT INTO app_trivia_event_registrations(event_id,user_id,registered_at) VALUES(?,?,?) ON CONFLICT DO NOTHING',
          [event, user, now],
        ),
      ];
    let gameId: string | null = null;
    if (join) {
      const q = await this.s.rows<any>(
        'SELECT q.id FROM app_trivia_game_questions g JOIN app_trivia_questions q ON q.id=g.question_id WHERE g.game_id=? AND q.team_id=? AND q.active=1 AND (q.verified=1 OR ?=1) ORDER BY g.position',
        [e.question_set_game_id, e.team_id, process.env.NODE_ENV === 'production' ? 0 : 1],
      );
      if (q.length !== DRILL_QUESTION_COUNT) throw Error('The event question set is not ready.');
      gameId = crypto.randomUUID();
      guards.push({
        sql: 'NOT EXISTS(SELECT 1 FROM app_trivia_event_registrations WHERE event_id=? AND user_id=? AND game_id IS NOT NULL)',
        values: [event, user],
      });
      writes.push(
        ...this.gameWrites(
          gameId,
          user,
          e.team_id,
          'FULL',
          q.map((x) => x.id),
        ),
        this.s.statement(
          'UPDATE app_trivia_event_registrations SET game_id=? WHERE event_id=? AND user_id=?',
          [gameId, event, user],
        ),
      );
    }
    try {
      await guardedBatch(this.s, guards, writes);
    } catch (error) {
      const [won] = await this.s.rows<any>(
        'SELECT game_id FROM app_trivia_event_registrations WHERE event_id=? AND user_id=?',
        [event, user],
      );
      if (join && won?.game_id) return { gameId: won.game_id as string };
      throw error;
    }
    return { gameId };
  }
}
