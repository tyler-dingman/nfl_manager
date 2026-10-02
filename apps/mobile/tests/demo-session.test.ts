import test from 'node:test';
import assert from 'node:assert/strict';
import { createDemoSession } from '../lib/demo-session';

test('credentials require an enabled build and exact password', () => {
  const session = createDemoSession();
  assert.equal(session.login(false, 'test@gmail.com', 'test'), null);
  assert.equal(session.login(true, 'someone@example.com', 'test'), null);
  assert.throws(() => session.login(true, 'test@gmail.com', 'wrong'));
  assert.equal(session.isActive(), false);
  assert.equal(session.login(true, ' TEST@gmail.com ', 'test')?.id, 'local-demo');
});

test('demo supplies local reads, rejects mutations and unknown endpoints, and logs out', async () => {
  const session = createDemoSession();
  session.login(true, 'test@gmail.com', 'test');
  assert.equal((await session.respond('/api/auth/me').json()).user.primaryEmail, 'test@gmail.com');
  assert.equal(session.respond('/api/content/homepage?team=KC').status, 200);
  assert.equal(session.respond('/api/commerce/checkout', { method: 'POST' }).status, 403);
  assert.equal(session.respond('https://example.com/api/private').status, 503);
  assert.equal(session.respond('/api/not-implemented').status, 503);
  session.logout();
  assert.equal(session.isActive(), false);
  assert.throws(() => session.respond('/api/auth/me'));
});

test('demo homepage includes an upcoming matchup outside game day', async () => {
  const session = createDemoSession();
  session.login(true, 'test@gmail.com', 'test');
  assert.equal((await session.respond('/api/game-day/homepage?team=KC').json()).game, null);
  const next = await session.respond('/api/content/next-game?team=KC').json();
  assert.equal(next.game.homeTeam, 'KC');
  assert.equal(next.game.awayTeam, 'LV');
  assert.equal(next.game.week, 4);
  assert.equal(next.game.kickoffConfirmed, true);
});

test('preview includes videos and player props instead of empty feeds', async () => {
  const session = createDemoSession();
  session.login(true, 'test@gmail.com', 'test');
  const videos = (await session.respond('/api/film-room?team=KC').json()).videos;
  assert.equal(videos.length, 3);
  assert.ok(
    videos.every(
      (video: { title: string; thumbnail: string }) =>
        video.title.startsWith('Preview:') && video.thumbnail,
    ),
  );
  const events = (await session.respond('/api/parlay-lab/events').json()).events;
  const markets = (await session.respond('/api/parlay-lab/research?eventId=demo-game').json())
    .markets;
  assert.equal(markets.length, 3);
  assert.ok(markets.every((market: { eventId: string }) => market.eventId === events[0].id));
});
