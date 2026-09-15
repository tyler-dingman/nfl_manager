import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const migration = readFileSync('db/migrations/035_parlay_lab_odds.sql', 'utf8');
test('odds schema enforces idempotent events, markets, and prices', () => {
  assert.match(migration, /UNIQUE \(provider, provider_event_id\)/);
  assert.match(migration, /UNIQUE \(event_id, provider_market_id, side, line_key\)/);
  assert.match(migration, /UNIQUE \(market_id, sportsbook\)/);
});
test('started events are locked by repository logic', () => {
  const source = readFileSync('src/server/odds/repository.ts', 'utf8');
  assert.match(source, /markets_locked=true/);
  assert.match(source, /kickoff_at <=/);
});
