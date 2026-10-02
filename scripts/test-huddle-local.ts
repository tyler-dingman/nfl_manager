import { loadEnvConfig } from '@next/env';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
loadEnvConfig(process.cwd());
async function main() {
  if (!['localhost', '127.0.0.1'].includes(new URL(process.env.DATABASE_URL ?? '').hostname))
    throw Error('Local database required');
  const { authDb } = await import('../src/server/auth/database');
  const { action, publicSnapshot, viewer, history } =
    await import('../src/server/huddle/repository');
  const sql = authDb(),
    a = randomUUID(),
    b = randomUUID(),
    room = `TEST:${randomUUID()}`;
  try {
    await sql`INSERT INTO users(id,display_name)VALUES(${a},'Huddle test A'),(${b},'Huddle test B')`;
    await action(
      a,
      room,
      { action: 'message', body: 'An excellent drive', clientId: randomUUID() },
      false,
      'play-1',
    );
    let snap = await publicSnapshot(room);
    assert.equal(snap.messages.length, 1);
    const id = snap.messages[0].id;
    assert.equal(snap.messages[0].playId, 'play-1');
    await action(b, room, { action: 'like', id, enabled: true }, false, null);
    assert.equal((await publicSnapshot(room)).messages[0].likes, 1);
    await action(b, room, { action: 'report', id, reason: 'Test report' }, false, null);
    await action(b, room, { action: 'block', userId: a }, false, null);
    assert.ok((await viewer(a, room)).hiddenUsers.includes(b));
    assert.ok((await viewer(b, room)).hiddenUsers.includes(a));
    await assert.rejects(() => action(b, room, { action: 'remove', id }, false, null), /Moderator/);
    await action(
      a,
      room,
      { action: 'poll', question: 'Who changed the game?', options: ['Offense', 'Defense'] },
      true,
      null,
    );
    const poll = (await publicSnapshot(room)).polls[0];
    await Promise.all([
      action(b, room, { action: 'vote', id: poll.id, choice: 0 }, false, null),
      action(b, room, { action: 'vote', id: poll.id, choice: 1 }, false, null),
    ]);
    assert.equal(
      (await publicSnapshot(room)).polls[0].counts.reduce((x, y) => x + y, 0),
      1,
    );
    await action(a, room, { action: 'remove', id }, true, null);
    assert.equal((await publicSnapshot(room)).messages[0].removed, true);
    await action(a, room, { action: 'suspend', userId: b, reason: 'Test restriction' }, true, null);
    await assert.rejects(
      () =>
        action(
          b,
          room,
          { action: 'message', body: 'restricted', clientId: randomUUID() },
          false,
          null,
        ),
      /restricted/,
    );
    const rows = Array.from({ length: 55 }, (_, i) => ({
      id: randomUUID(),
      room,
      user_id: a,
      body: `History ${i}`,
      client_id: randomUUID(),
      created_at: '2026-01-01T00:00:00Z',
    }));
    await sql`INSERT INTO huddle_messages ${sql(rows, 'id', 'room', 'user_id', 'body', 'client_id', 'created_at')}`;
    const first = await history(
      room,
      '2030-01-01T00:00:00.000Z|ffffffff-ffff-ffff-ffff-ffffffffffff',
    );
    const oldest = first.at(-1)!;
    const second = await history(room, `${oldest.at}|${oldest.id}`);
    assert.equal(first.length, 50);
    assert.equal(second.length, 5);
    assert.equal(new Set([...first, ...second].map((x) => x.id)).size, 55);
    console.log(
      'PASS local DB: messages, context, reactions, bilateral block, report, moderator authorization, concurrent single vote, removal, enforcement',
    );
  } finally {
    await sql`DELETE FROM huddle_enforcement WHERE user_id IN (${a},${b})`;
    await sql`DELETE FROM huddle_reports WHERE user_id IN (${a},${b})`;
    await sql`DELETE FROM huddle_user_filters WHERE user_id IN (${a},${b})`;
    await sql`DELETE FROM huddle_poll_votes WHERE user_id IN (${a},${b})`;
    await sql`DELETE FROM huddle_polls WHERE room=${room}`;
    await sql`DELETE FROM huddle_messages WHERE room=${room}`;
    await sql`DELETE FROM users WHERE id IN (${a},${b})`;
    await sql.end();
  }
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
