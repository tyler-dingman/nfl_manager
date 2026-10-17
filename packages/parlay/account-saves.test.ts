import test from 'node:test';
import assert from 'node:assert/strict';
import {
  accountParlays,
  saveAccountParlay,
  mergeSavedParlays,
  compactParlaySnapshot,
} from './account-saves';
import { snapshotSavedPlay } from '../../src/components/parlay-lab/saved-plays';
const play = snapshotSavedPlay({
  id: 'fixture',
  selections: [
    {
      id: 'm',
      playerName: 'Player',
      marketType: 'RECEPTIONS',
      line: 4.5,
      side: 'OVER',
      odds: -200,
      sportsbook: 'FANDUEL',
      trend: { trendScore: 84 },
    },
  ],
});
test('account save uses existing authenticated saved-content schema and preserves snapshots', async () => {
  let saved: any;
  const request = async (_url: string, init?: RequestInit) => {
    if (init?.method === 'POST') {
      saved = JSON.parse(String(init.body));
      return Response.json({ ok: true });
    }
    return Response.json({ items: [saved, { contentType: 'STORY', metadata: { kind: 'STORY' } }] });
  };
  await saveAccountParlay(request, play);
  assert.equal(saved.contentType, 'OTHER');
  assert.equal(saved.metadata.play.selections[0].line, 4.5);
  assert.equal(saved.metadata.play.selections[0].trend.trendScore, 84);
  assert.deepEqual(
    await accountParlays(request),
    JSON.parse(JSON.stringify([compactParlaySnapshot(play)])),
  );
  assert.equal(mergeSavedParlays([play], [play]).length, 1);
});
test('signed-out saves fail honestly and account-load failures are not successful empties', async () => {
  await assert.rejects(
    saveAccountParlay(async () => new Response('', { status: 401 }), play),
    /Sign in/,
  );
  await assert.rejects(
    accountParlays(async () => new Response('', { status: 500 })),
    /could not be loaded/,
  );
});
