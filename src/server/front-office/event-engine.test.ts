import assert from 'node:assert/strict';
import test from 'node:test';
import { createFranchiseSimulation, advanceSimulation } from '@/lib/franchise-simulation';
import { generateFrontOfficeEvents } from './event-engine';

const teams = [
  { abbr: 'CHI', conference: 'NFC', division: 'North', overall: 80 },
  { abbr: 'GB', conference: 'NFC', division: 'North', overall: 80 },
];

test('front office event engine creates stable, state-backed events', () => {
    const initial = createFranchiseSimulation({ seed: 'test', season: 2026, teams,
      games: [{ id: 'g1', week: 1, homeTeam: 'CHI', awayTeam: 'GB' }] });
    const advanced = advanceSimulation(initial, 'week-1');
    const first = generateFrontOfficeEvents({ saveId: 'save', teamAbbr: 'CHI', previous: initial, current: advanced });
    const second = generateFrontOfficeEvents({ saveId: 'save', teamAbbr: 'CHI', previous: initial, current: advanced });
    assert.equal(first[0]?.metadata.gameId, 'g1');
    assert.equal(first[0]?.id, second[0]?.id);
    assert.equal(first[0]?.dedupeKey, second[0]?.dedupeKey);
});

test('front office event engine caps generated events per simulated week', () => {
    const initial = createFranchiseSimulation({ seed: 'bulk', season: 2026, teams,
      games: [{ id: 'g1', week: 1, homeTeam: 'CHI', awayTeam: 'GB' }] });
    const advanced = advanceSimulation(initial, 'week-1');
    const events = generateFrontOfficeEvents({ saveId: 'save', teamAbbr: 'CHI', previous: initial, current: advanced });
    assert.ok(events.length <= 3);
});
