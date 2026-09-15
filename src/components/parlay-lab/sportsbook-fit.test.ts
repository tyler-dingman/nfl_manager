import assert from 'node:assert/strict';
import test from 'node:test';
import { rankSportsbookFits, type FitMarket } from './sportsbook-fit';

const market = (id: string, sportsbook: FitMarket['sportsbook'], odds: number): FitMarket => ({
  id,
  sportsbook,
  odds,
  available: true,
  deeplink: null,
});

test('coverage wins first and stored price quality breaks ties', () => {
  const legs = [market('a', 'FANDUEL', -110), market('b', 'FANDUEL', -110)];
  const fits = rankSportsbookFits(legs, [
    ...legs,
    market('a', 'DRAFTKINGS', -105),
    market('b', 'DRAFTKINGS', -105),
    market('a', 'BETMGM', 100),
  ]);
  assert.equal(fits[0].sportsbook.id, 'DRAFTKINGS');
  assert.equal(fits[0].matchedLegs, 2);
  assert.equal(fits.find((fit) => fit.sportsbook.id === 'BETMGM')?.matchedLegs, 1);
});

test('returns configured books even when none match', () => {
  const fits = rankSportsbookFits([market('a', 'FANDUEL', -110)], []);
  assert.equal(fits[0].matchedLegs, 0);
  assert.ok(fits.length >= 5);
});
