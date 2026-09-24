import assert from 'node:assert/strict';
import test from 'node:test';

// Run against a local dev server with TRADE_TEST_BASE_URL=http://localhost:3000.
// HTTP is intentional: importing handlers together misses Next's separate route bundles.
const baseURL = process.env.TRADE_TEST_BASE_URL;

test(
  'Trade Machine preserves multiple assets across real API routes',
  { skip: !baseURL },
  async () => {
    async function post(path: string, body: Record<string, unknown>) {
      const response = await fetch(new URL(path, baseURL), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const result = await response.json();
      assert.equal(response.ok, true, `${path}: ${JSON.stringify(result)}`);
      return result;
    }

    // A fresh isolated save; never mutate an existing user's franchise.
    const save = await post('/api/saves/create', { teamAbbr: 'SF', year: 2026 });
    const context = { saveId: save.saveId, partnerTeamAbbr: 'ARI' };
    const { trade } = await post('/api/trades/create', { ...context, teamAbbr: 'SF' });
    const assets = await post('/api/trade-offers/assets', context);
    const selectedIds: string[] = [];
    for (const player of assets.user.players.slice(0, 3)) {
      selectedIds.push(player.id);
      const updated = await post(`/api/trades/${trade.id}/add-asset`, {
        saveId: save.saveId,
        side: 'send',
        type: 'player',
        playerId: player.id,
      });
      assert.deepEqual(
        updated.sendAssets.map((asset: { playerId: string }) => asset.playerId),
        selectedIds,
      );
      await post(`/api/trades/${trade.id}/analyze`, { saveId: save.saveId });
    }
    assert.equal(selectedIds.length, 3);
    const removed = await post(`/api/trades/${trade.id}/remove-asset`, {
      saveId: save.saveId,
      side: 'send',
      playerId: selectedIds[0],
    });
    assert.deepEqual(
      removed.sendAssets.map((asset: { playerId: string }) => asset.playerId),
      selectedIds.slice(1),
    );
  },
);
