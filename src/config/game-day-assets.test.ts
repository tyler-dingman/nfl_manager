import test from 'node:test';
import assert from 'node:assert/strict';
import { stat } from 'node:fs/promises';
import sharp from 'sharp';
import { GAME_DAY_HERO_ASSETS, gameDayHeroAsset } from './game-day-hero';
test('all 32 web/native stadium derivatives retain dimensions and original URLs with bounded transfer sizes', async () => {
  assert.equal(Object.keys(GAME_DAY_HERO_ASSETS).length, 32);
  for (const [team, original] of Object.entries(GAME_DAY_HERO_ASSETS)) {
    const optimized = gameDayHeroAsset(team);
    assert(optimized?.endsWith('.webp'));
    const a = await sharp('public' + original).metadata(),
      b = await sharp('public' + optimized).metadata();
    assert.equal(a.width, b.width);
    assert.equal(a.height, b.height);
    assert((await stat('public' + optimized)).size < (await stat('public' + original)).size * 0.25);
  }
  assert.equal(gameDayHeroAsset('UNKNOWN'), undefined);
});
