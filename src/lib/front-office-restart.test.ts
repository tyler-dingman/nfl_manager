import assert from 'node:assert/strict';
import test from 'node:test';
import { restartFranchiseAtWeekOne } from './front-office-restart';

test('restart creates an independent save and initializes Week 1 in order', async () => {
  const calls: Array<{ path: string; body: Record<string, unknown> }> = [];
  const result = await restartFranchiseAtWeekOne(async (path, init) => {
    const body = JSON.parse(String(init.body));
    calls.push({ path, body });
    if (path === '/api/saves/create') return Response.json({ ok: true, saveId: 'fresh-save', year: 2026 });
    if (path === '/api/front-office/state') return Response.json({ ok: true });
    return Response.json({ state: { phase: 'week-1', currentWeek: 0 } });
  }, 'KC', 2026);
  assert.deepEqual(calls, [
    { path: '/api/saves/create', body: { teamAbbr: 'KC', year: 2026, fresh: true } },
    { path: '/api/front-office/state', body: { saveId: 'fresh-save', teamAbbr: 'KC', season: 2026, selectedPath: 'full', simulationPhase: 'week-1' } },
    { path: '/api/front-office/simulate', body: { saveId: 'fresh-save', action: 'initialize', target: 'week-1' } },
  ]);
  assert.equal(result.state.currentWeek, 0);
});

test('failed save creation stops before initialization', async () => {
  let calls = 0;
  await assert.rejects(restartFranchiseAtWeekOne(async () => {
    calls++;
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }, 'KC', 2026), /Unauthorized/);
  assert.equal(calls, 1);
});
