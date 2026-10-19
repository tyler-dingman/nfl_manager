import test from 'node:test';
import assert from 'node:assert/strict';
import { harness } from '../test/harness';
import { Storage, type SqlDatabase } from '../../../packages/storage/core';
import { D1Objects } from '../../../packages/storage/d1-objects';
import { JsonTree } from '../../../packages/storage/json-tree';
import { prepareSavedOddsEvidence } from '../../../packages/storage/saved-odds-evidence';
test(
  'prepared saved odds preserves original identities/fields, rejects incomplete legacy evidence and never retires source',
  { timeout: 60000 },
  async () => {
    const h = await harness(false, true, 999, undefined, false);
    try {
      const s = new Storage(
        h.binding as unknown as SqlDatabase,
        new D1Objects(h.binding as unknown as SqlDatabase),
      );
      const rows = Array.from({ length: 2000 }, (_, i) => ({
        id: 'market-' + i,
        playerId: 'player-' + i,
        sportsbook: 'original-book',
        marketType: 'PASS_YARDS',
        side: 'OVER',
        normalizedKey: 'key-' + i,
        line: 200.5,
        odds: -110,
        available: true,
        originalProviderFields: { name: 'Attribution ' + i },
      }));
      const root = await new JsonTree(s).put(rows),
        board = await s.put({ schema: 1, eventId: 'original-event', asOf: 123456, root });
      const prepared = await prepareSavedOddsEvidence(s, 'original-event', board, [
        'market-3',
        'market-7',
      ]);
      assert.deepEqual(prepared.value.markets, [rows[3], rows[7]]);
      assert.equal(prepared.value.asOf, 123456);
      assert.equal((await s.get<any>(board)).root, root);
      assert.deepEqual(await new JsonTree(s).get(root), rows);
      await assert.rejects(prepareSavedOddsEvidence(s, 'wrong-event', board, ['market-3']));
      await assert.rejects(
        prepareSavedOddsEvidence(s, 'original-event', board, ['market-3', 'market-3']),
      );
      await assert.rejects(prepareSavedOddsEvidence(s, 'original-event', board, ['missing']));
      const badRoot = await new JsonTree(s).put([{ ...rows[3], playerId: null }]);
      const bad = await s.put({
        schema: 1,
        eventId: 'original-event',
        asOf: 123456,
        root: badRoot,
      });
      await assert.rejects(
        prepareSavedOddsEvidence(s, 'original-event', bad, ['market-3']),
        /Incomplete/,
      );
      assert.equal((await s.rows('PRAGMA foreign_key_check')).length, 0);
    } finally {
      await h.close();
    }
  },
);
