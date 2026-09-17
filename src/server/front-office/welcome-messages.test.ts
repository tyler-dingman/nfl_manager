import assert from 'node:assert/strict';
import test from 'node:test';
import { NFL_LEAGUE_DATA } from '@/server/data/nfl-data';
import type { PlayerRowDTO } from '@/types/player';
import type { FrontOfficeSaveMetadata } from '@/types/front-office';
import {
  buildWeekOneWelcomeEvents,
  NFL_HEAD_COACHES_2026,
  resolveStartingQuarterback,
} from './welcome-messages';

const rosterFor = (teamAbbr: string): PlayerRowDTO[] =>
  NFL_LEAGUE_DATA.players
    .filter((player) => player.teamAbbr === teamAbbr)
    .map((player) => ({
      id: player.id,
      firstName: player.name.split(' ')[0] ?? '',
      lastName: player.name.split(' ').slice(1).join(' '),
      position: player.position,
      rating: player.rating,
      baselineRating: player.baselineRating,
      maddenRating: player.maddenRating,
      headshotUrl: player.headshotUrl,
      contractYearsRemaining: 1,
      capHit: '$0',
      status: 'active',
    }));

test('all 32 teams resolve a 2026 head coach and QB1 from league rosters', () => {
  assert.equal(NFL_LEAGUE_DATA.teams.length, 32);
  for (const team of NFL_LEAGUE_DATA.teams) {
    assert.ok(NFL_HEAD_COACHES_2026[team.abbr], `${team.abbr} coach`);
    assert.ok(resolveStartingQuarterback(rosterFor(team.abbr)), `${team.abbr} QB1`);
  }
});

test('new 2026 Full Experience Week 1 saves receive exactly two ordered messages', () => {
  const save = {
    saveId: 'welcome-test',
    teamAbbr: 'CHI',
    season: 2026,
    selectedPath: 'full',
    simulationPhase: 'week-1',
    initializedAt: null,
    simulation: { currentWeek: 1 },
  } as FrontOfficeSaveMetadata;
  const events = buildWeekOneWelcomeEvents(save, rosterFor('CHI'));
  assert.equal(events.length, 2);
  assert.equal(events[0].headline, 'Ben Johnson');
  assert.equal(events[0].summary, "Let's get off to a fast start!");
  assert.equal(events[1].summary, "Excited to get this season going. Let's make it a great one!");
  assert.deepEqual(
    events.map((event) => event.dedupeKey),
    ['welcome:head-coach', 'welcome:starting-qb'],
  );
});

test('welcome messages stay limited to Full Experience, season 2026, Week 1', () => {
  const base = {
    saveId: 'x',
    teamAbbr: 'CHI',
    season: 2026,
    selectedPath: 'full',
    simulationPhase: 'week-1',
    initializedAt: null,
    simulation: { currentWeek: 1 },
  } as FrontOfficeSaveMetadata;
  assert.equal(
    buildWeekOneWelcomeEvents({ ...base, selectedPath: 'draft' }, rosterFor('CHI')).length,
    0,
  );
  assert.equal(buildWeekOneWelcomeEvents({ ...base, season: 2025 }, rosterFor('CHI')).length, 0);
  assert.equal(
    buildWeekOneWelcomeEvents(
      { ...base, simulation: { ...base.simulation!, currentWeek: 2 } },
      rosterFor('CHI'),
    ).length,
    0,
  );
});
