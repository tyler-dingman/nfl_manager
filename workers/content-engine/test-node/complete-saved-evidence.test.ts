import test from 'node:test';
import assert from 'node:assert/strict';
import { harness } from '../test/harness';
import { Storage, objectKey } from '../../../packages/storage/core';
import { D1Objects } from '../../../packages/storage/d1-objects';
import { JsonTree } from '../../../packages/storage/json-tree';
import { prepareCompleteSavedOddsEvidence } from '../../../packages/storage/saved-odds-evidence';
test(
  'complete saved selections preserve all frozen provider/price identities and restore without reading original board',
  { timeout: 60000 },
  async () => {
    const h = await harness(false, true, 999, undefined, false),
      target = await harness(false, true, 999, undefined, false);
    try {
      const s = new Storage(h.binding, new D1Objects(h.binding)),
        r = new Storage(target.binding, new D1Objects(target.binding));
      const rows = Array.from({ length: 2000 }, (_, i) => ({
        id: 'market-' + i,
        providerMarketId: 'provider-market-' + i,
        providerPlayerId: 'provider-player-' + i,
        playerId: 'player-' + i,
        sportsbook: 'original-book',
        marketType: 'PASS_YARDS',
        side: 'OVER',
        normalizedKey: 'original-key-' + i,
        line: 200.5,
        odds: -110,
        available: true,
        providerSelectionId: 'provider-selection-' + i,
        originalSourceFields: { attribution: 'Original provider', unmodeled: 'preserve me' },
      }));
      const root = await new JsonTree(s).put(rows),
        boardHash = await s.put({
          schema: 1,
          eventId: 'original-event',
          providerEventId: 'provider-event-id',
          sourceIdentity: 'SYNTHETIC_VERIFIED_PROVIDER',
          asOf: 123456,
          root,
        });
      const input = {
        eventId: 'original-event',
        providerEventId: 'provider-event-id',
        sourceIdentity: 'SYNTHETIC_VERIFIED_PROVIDER',
        asOf: 123456,
        boardHash,
        selections: [
          {
            marketId: 'market-7',
            providerMarketId: 'provider-market-7',
            providerPlayerId: 'provider-player-7',
            providerSelectionId: 'provider-selection-7',
            playerId: 'player-7',
            sportsbook: 'original-book',
            selection: 'OVER',
            line: 200.5,
            odds: -110,
          },
        ],
      };
      const complete = await prepareCompleteSavedOddsEvidence(s, input);
      assert.equal(complete.boardReleaseAuthorized, false);
      assert.deepEqual(complete.value.markets, [rows[7]]);
      assert.equal(await r.put(complete.value), complete.hash);
      assert.deepEqual(await r.get(complete.hash), complete.value);
      assert.equal(await r.objects.get(objectKey(boardHash)), null);
      assert.deepEqual(await new JsonTree(s).get((await s.get<any>(boardHash)).root), rows);
      for (const patch of [
        { eventId: 'wrong' },
        { providerEventId: 'wrong' },
        { sourceIdentity: 'wrong' },
        { asOf: 1 },
        { selections: [{ ...input.selections[0], selection: 'UNDER' }] },
        { selections: [{ ...input.selections[0], odds: -120 }] },
        { selections: [{ ...input.selections[0], line: 201.5 }] },
        { selections: [{ ...input.selections[0], sportsbook: 'wrong' }] },
        { selections: [{ ...input.selections[0], marketId: 'wrong' }] },
        { selections: [{ ...input.selections[0], playerId: 'wrong' }] },
      ])
        await assert.rejects(prepareCompleteSavedOddsEvidence(s, { ...input, ...patch }));
      const second = {
        ...rows[7],
        sportsbook: 'second-book',
        providerSelectionId: 'second-provider-selection',
      };
      const multiRoot = await new JsonTree(s).put([rows[7], second]);
      const multiBoard = await s.put({ ...(await s.get<any>(boardHash)), root: multiRoot });
      const both = await prepareCompleteSavedOddsEvidence(s, {
        ...input,
        boardHash: multiBoard,
        selections: [
          input.selections[0],
          {
            ...input.selections[0],
            sportsbook: 'second-book',
            providerSelectionId: 'second-provider-selection',
          },
        ],
      });
      assert.deepEqual(both.value.markets, [rows[7], second]);
      await assert.rejects(
        prepareCompleteSavedOddsEvidence(s, {
          ...input,
          selections: [input.selections[0], input.selections[0]],
        }),
        /Duplicate/,
      );
      await assert.rejects(
        prepareCompleteSavedOddsEvidence(s, {
          ...input,
          selections: [{ ...input.selections[0], providerMarketId: 'wrong' }],
        }),
        /provider selection identity/,
      );
      const legacy = await s.put({ schema: 1, eventId: input.eventId, asOf: input.asOf, root });
      await assert.rejects(
        prepareCompleteSavedOddsEvidence(s, { ...input, boardHash: legacy }),
        /frozen source identity/,
      );
    } finally {
      await h.close();
      await target.close();
    }
  },
);
