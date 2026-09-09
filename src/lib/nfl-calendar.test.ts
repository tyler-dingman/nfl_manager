import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveNFLSeasonPhase, type NFLScheduleGame } from './nfl-calendar';

const games: NFLScheduleGame[] = [
  { id: 'pre', season: 2026, seasonType: 'PRE', week: 2, startsAt: '2026-08-20T23:00:00Z' },
  { id: 'w1', season: 2026, seasonType: 'REG', week: 1, startsAt: '2026-09-10T00:20:00Z' },
  { id: 'w2', season: 2026, seasonType: 'REG', week: 2, startsAt: '2026-09-17T00:20:00Z' },
  {
    id: 'w1-mnf',
    season: 2026,
    seasonType: 'REG',
    week: 1,
    startsAt: '2026-09-15T00:15:00Z',
  },
  {
    id: 'w2-mnf',
    season: 2026,
    seasonType: 'REG',
    week: 2,
    startsAt: '2026-09-22T00:15:00Z',
  },
  { id: 'w9', season: 2026, seasonType: 'REG', week: 9, startsAt: '2026-11-08T18:00:00Z' },
  { id: 'w18', season: 2026, seasonType: 'REG', week: 18, startsAt: '2027-01-03T18:00:00Z' },
  {
    id: 'wc',
    season: 2026,
    seasonType: 'POST',
    week: 1,
    startsAt: '2027-01-09T21:00:00Z',
    name: 'Wild Card',
  },
  {
    id: 'div',
    season: 2026,
    seasonType: 'POST',
    week: 2,
    startsAt: '2027-01-16T21:00:00Z',
    name: 'Divisional Round',
  },
  {
    id: 'conf',
    season: 2026,
    seasonType: 'POST',
    week: 3,
    startsAt: '2027-01-24T20:00:00Z',
    name: 'Conference Championships',
  },
  {
    id: 'sb',
    season: 2026,
    seasonType: 'POST',
    week: 5,
    startsAt: '2027-02-14T23:30:00Z',
    name: 'Super Bowl LXI',
  },
  {
    id: 'next-w1',
    season: 2027,
    seasonType: 'REG',
    week: 1,
    startsAt: '2027-09-09T00:20:00Z',
  },
];

test('uses fixed schedule metadata for preseason and regular-season weeks including Week 18', () => {
  assert.equal(
    resolveNFLSeasonPhase(new Date('2026-08-20T18:00:00Z'), games).phaseType,
    'preseason',
  );
  assert.equal(resolveNFLSeasonPhase(new Date('2026-09-14T18:00:00Z'), games).phaseLabel, 'Week 1');
  assert.equal(resolveNFLSeasonPhase(new Date('2026-09-15T18:00:00Z'), games).phaseLabel, 'Week 2');
  assert.equal(resolveNFLSeasonPhase(new Date('2026-11-08T18:00:00Z'), games).phaseLabel, 'Week 9');
  assert.equal(
    resolveNFLSeasonPhase(new Date('2027-01-04T18:00:00Z'), games).phaseLabel,
    'Week 18',
  );
});

test('maps every postseason round and keeps Super Bowl active through its game window', () => {
  assert.equal(
    resolveNFLSeasonPhase(new Date('2027-01-10T18:00:00Z'), games).phaseLabel,
    'Wild Card',
  );
  assert.equal(
    resolveNFLSeasonPhase(new Date('2027-01-17T18:00:00Z'), games).phaseLabel,
    'Divisional Round',
  );
  assert.equal(
    resolveNFLSeasonPhase(new Date('2027-01-25T18:00:00Z'), games).phaseLabel,
    'Conference Championships',
  );
  assert.equal(
    resolveNFLSeasonPhase(new Date('2027-02-15T05:00:00Z'), games).phaseLabel,
    'Super Bowl',
  );
  assert.equal(
    resolveNFLSeasonPhase(new Date('2027-02-17T18:00:00Z'), games).phaseType,
    'offseason',
  );
});

test('handles offseason and season-year rollover using event season metadata', () => {
  const offseason = resolveNFLSeasonPhase(new Date('2027-02-17T18:00:00Z'), games);
  assert.equal(offseason.phaseType, 'offseason');

  const nextSeason = resolveNFLSeasonPhase(new Date('2027-09-09T18:00:00Z'), games);
  assert.equal(nextSeason.season, 2027);
  assert.equal(nextSeason.phaseLabel, 'Week 1');
});

test('uses centralized official 2026 free agency and draft dates outside game windows', () => {
  assert.equal(
    resolveNFLSeasonPhase(new Date('2026-03-12T18:00:00Z'), []).phaseType,
    'free_agency',
  );
  assert.equal(resolveNFLSeasonPhase(new Date('2026-04-24T18:00:00Z'), []).phaseType, 'draft');
});
