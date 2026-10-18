import test from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { harness } from '../test/harness';
import { Storage, type SqlDatabase } from '../../../packages/storage/core';
import { PrivateObjects, type Bucket } from '../../../packages/storage/objects';
import { D1AuthRepository } from '../../../packages/storage/auth';
import { withApplicationBindings } from '../../../src/server/persistence/bindings';
import { GET } from '../../../src/app/api/trivia/daily/route';
import { POST } from '../../../src/app/api/trivia/daily/answer/route';
import { importPostgres, type PostgresExport } from '../../../packages/storage/import';
test('actual daily trivia API uses D1, hides correct answers, retains progress and rejects cross-user replay', async () => {
  const h = await harness();
  try {
    const objects = new PrivateObjects(
        (await h.mf.getR2Bucket('EDITORIAL_ARCHIVE')) as unknown as Bucket,
      ),
      db = h.binding as unknown as SqlDatabase,
      s = new Storage(db, objects),
      auth = new D1AuthRepository(s);
    const user = (await auth.createEmailUser({
      email: 'daily-route@example.invalid',
      passwordHash: 'original',
    }))!;
    await auth.verifyUserEmail(user.id);
    await auth.createSession({ userId: user.id, token: 'synthetic-phase-four-session' });
    await s
      .statement(
        "INSERT INTO app_trivia_questions(id,team_id,question,answer_a,answer_b,answer_c,answer_d,correct_answer,explanation,category,verified) VALUES('route-q','KC','Question?','a','b','c','d','A','Attribution','NFL',1)",
      )
      .run();
    const bindings = {
      db,
      objects,
      env: { APP_DATA_BACKEND: 'd1', AUTH_BASE_URL: 'https://local.invalid', APP_RUNTIME: 'node' },
    };
    const invoke = (handler: any, url: string, body?: any) =>
      withApplicationBindings(bindings, () =>
        handler(
          new NextRequest('https://local.invalid' + url, {
            method: body ? 'POST' : 'GET',
            headers: {
              cookie: 'dd_session=synthetic-phase-four-session',
              origin: 'https://local.invalid',
              'content-type': 'application/json',
            },
            ...(body ? { body: JSON.stringify(body) } : {}),
          }),
        ),
      );
    const shown = await invoke(GET, '/api/trivia/daily?team=KC');
    assert.equal(shown.status, 200);
    const daily = await shown.json();
    assert(!('correctAnswer' in daily.dailyQuestion));
    const input = {
      teamId: 'KC',
      dailyQuestionId: daily.dailyQuestion.id,
      questionId: 'route-q',
      selectedAnswer: 'A',
      responseTimeMs: 0,
    };
    const answer = await invoke(POST, '/api/trivia/daily/answer', input);
    assert.equal(answer.status, 200);
    const accepted = await answer.json();
    assert(accepted.accepted);
    assert.equal(accepted.moveTheChains.lifetimeYards, 1);
    const replay = await invoke(POST, '/api/trivia/daily/answer', input);
    assert.equal((await replay.json()).accepted, false);
    const corrupt = await invoke(POST, '/api/trivia/daily/answer', {
      ...input,
      questionId: 'someone-else',
    });
    assert.equal(corrupt.status, 400);
    assert.equal((await s.rows('SELECT id FROM app_trivia_answers')).length, 1);
  } finally {
    await h.close();
  }
});
test('representative PostgreSQL daily trivia and reward IDs migrate losslessly with original relationships', async () => {
  const h = await harness();
  try {
    const s = new Storage(
      h.binding as unknown as SqlDatabase,
      new PrivateObjects((await h.mf.getR2Bucket('EDITORIAL_ARCHIVE')) as unknown as Bucket),
    );
    const now = '2026-10-18T15:00:00.000Z';
    const rows: Record<string, any[]> = {
      users: [
        {
          id: 'original-user',
          primary_email: 'original@example.invalid',
          status: 'ACTIVE',
          created_at: now,
          updated_at: now,
        },
      ],
      trivia_questions: [
        {
          id: 'original-question',
          team_id: 'KC',
          question: 'Question?',
          answer_a: 'a',
          answer_b: 'b',
          answer_c: 'c',
          answer_d: 'd',
          correct_answer: 'A',
          explanation: 'Original attribution',
          category: 'NFL',
          verified: true,
          active: true,
        },
      ],
      trivia_daily_questions: [
        {
          id: 'original-daily',
          team_id: 'KC',
          question_date: '2026-10-18',
          question_id: 'original-question',
        },
      ],
      trivia_daily_views: [
        { user_id: 'original-user', daily_question_id: 'original-daily', presented_at: now },
      ],
      trivia_answers: [
        {
          id: 'original-answer',
          user_id: 'original-user',
          daily_question_id: 'original-daily',
          question_id: 'original-question',
          selected_answer: 'A',
          correct: true,
          response_time_ms: 1000,
          points_awarded: 39,
          answered_at: now,
        },
      ],
      trivia_stats: [
        {
          user_id: 'original-user',
          lifetime_points: 39,
          weekly_points: 39,
          questions_answered: 1,
          correct_answers: 1,
          games_played: 0,
          current_streak: 0,
          best_streak: 0,
        },
      ],
      move_the_chains_accounts: [
        { user_id: 'original-user', current_drive_yards: 1, touchdowns: 0, lifetime_yards: 1 },
      ],
      move_the_chains_events: [
        {
          id: 'original-award',
          user_id: 'original-user',
          event_type: 'DAILY_TRIVIA_CORRECT',
          yards: 1,
          source_type: 'TRIVIA_DAILY',
          source_id: 'original-daily',
          idempotency_key: 'original-key',
          created_at: now,
        },
      ],
      reward_definitions: [
        {
          id: 'original-reward',
          type: 'DISCOUNT',
          title: 'Original',
          description: 'Original reward',
          threshold_yards: 1,
          discount_percent: 5,
          active: true,
        },
      ],
      user_rewards: [
        {
          id: 'original-unlock',
          user_id: 'original-user',
          reward_definition_id: 'original-reward',
          status: 'AVAILABLE',
          unlocked_at: now,
        },
      ],
    };
    const source: PostgresExport = {
      schema: 1,
      mode: 'SYNTHETIC_REPEATABLE_READ',
      tables: Object.entries(rows).map(([name, values]) => ({
        name,
        primaryKey: 'id' in values[0] ? ['id'] : ['user_id'],
        rows: values.map((v) => JSON.stringify(v)),
      })),
    };
    const fingerprint = JSON.stringify(source),
      imported = await importPostgres(s, source);
    assert.equal(imported.archivedRows, 10);
    assert.equal(imported.typedRows, 11);
    assert.equal(JSON.stringify(source), fingerprint);
    assert.equal((await s.rows<any>('SELECT id FROM app_trivia_answers'))[0].id, 'original-answer');
    assert.equal(
      (await s.rows<any>('SELECT lifetime_yards FROM app_reward_accounts'))[0].lifetime_yards,
      1,
    );
    assert.equal((await s.rows('PRAGMA foreign_key_check')).length, 0);
    await assert.rejects(importPostgres(s, source), /fresh unserved/);
  } finally {
    await h.close();
  }
});
