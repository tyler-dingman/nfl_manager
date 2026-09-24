import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  gameKickoffDisplay,
  gameWeekLabel,
  beatGameMetadata,
  type CanonicalGame,
} from '@/lib/canonical-game';
import { resolveStoryGame, type GameStory } from './resolve';
import { adaptBeatStory } from '@/components/beat/beat-story-adapter';
const game: CanonicalGame = {
  id: 'g1',
  season: 2026,
  seasonType: 'REG',
  week: 1,
  homeTeam: 'KC',
  awayTeam: 'DEN',
  kickoffAt: '2026-09-15T00:15:00Z',
  kickoffConfirmed: true,
  status: 'SCHEDULED',
  homeScore: null,
  awayScore: null,
  overtime: false,
  venue: null,
  broadcastNetwork: null,
};
const story: GameStory = {
  id: 's1',
  teamAbbr: 'DEN',
  category: 'GAME',
  headline: 'Broncos vs Chiefs',
  summary: 'Game preview',
  publishedAt: '2026-09-13T12:00:00Z',
};
test('Eastern display handles summer/winter DST and withheld kickoff', () => {
  assert.equal(gameKickoffDisplay(game), 'MON · 8:15 PM ET');
  assert.equal(
    gameKickoffDisplay({ ...game, kickoffAt: '2026-12-14T01:20:00Z' }),
    'SUN · 8:20 PM ET',
  );
  assert.equal(gameKickoffDisplay({ ...game, kickoffConfirmed: false }), undefined);
});
test('postseason labels and preseason are explicit', () => {
  for (const [week, label] of [
    [1, 'WILD CARD'],
    [2, 'DIVISIONAL'],
    [3, 'CONF CHAMP'],
    [5, 'SUPER BOWL'],
  ] as const)
    assert.equal(gameWeekLabel({ ...game, seasonType: 'POST', week }), label);
  assert.equal(gameWeekLabel({ ...game, seasonType: 'PRE' }), 'PRESEASON 1');
});
test('explicit ID precedes textual week; rejects unrelated explicit game', () => {
  assert.equal(resolveStoryGame({ ...story, gameId: 'g1', gameWeek: 9 }, [game]).gameId, 'g1');
  assert.equal(
    resolveStoryGame({ ...story, teamAbbr: 'BUF', gameId: 'g1' }, [game]).confidence,
    'unresolved',
  );
});
test('week disambiguates division rematch; conflict never falls through to nearest', () => {
  const rematch = {
    ...game,
    id: 'g2',
    week: 12,
    homeTeam: 'DEN',
    awayTeam: 'KC',
    kickoffAt: '2026-11-29T18:00:00Z',
  };
  assert.equal(resolveStoryGame({ ...story, gameWeek: 12 }, [game, rematch]).gameId, 'g2');
  assert.equal(
    resolveStoryGame({ ...story, gameWeek: 2 }, [game, rematch]).confidence,
    'unresolved',
  );
});
test('date and nearby publication resolve; distant/ambiguous games do not', () => {
  assert.equal(
    resolveStoryGame({ ...story, gameDate: '2026-09-14' }, [game]).method,
    'team-opponent-date',
  );
  assert.equal(resolveStoryGame(story, [game]).method, 'team-opponent-publication');
  assert.equal(
    resolveStoryGame({ ...story, publishedAt: '2026-10-14' }, [game]).confidence,
    'unresolved',
  );
  assert.equal(
    resolveStoryGame(story, [game, { ...game, id: 'g2', kickoffAt: '2026-09-16T00:15:00Z' }])
      .confidence,
    'unresolved',
  );
});
test('unknown and multiple opponents do not force a game', () => {
  assert.equal(
    resolveStoryGame({ ...story, headline: 'How to watch the home opener' }, [game]).confidence,
    'unresolved',
  );
  assert.equal(
    resolveStoryGame({ ...story, headline: 'Chiefs and Bills opponents preview' }, [game])
      .confidence,
    'unresolved',
  );
});
test('canonical game yields identical ordering, week and kickoff across articles', () => {
  const a = adaptBeatStory({ ...story, game: beatGameMetadata(game, 'DEN') });
  const b = adaptBeatStory({
    ...story,
    teamAbbr: 'KC',
    headline: 'How to Watch Chiefs vs Broncos Week 1',
    game: beatGameMetadata(game, 'KC'),
  });
  assert.deepEqual(a.graphic, b.graphic);
  assert.deepEqual(a.graphic, {
    family: 'game-matchup',
    leftTeam: 'DEN',
    rightTeam: 'KC',
    week: 'WEEK 1',
    kickoff: 'MON · 8:15 PM ET',
  });
});
test('updated canonical final scores override stale text with OT and stable ordering', () => {
  const final = { ...game, status: 'FINAL' as const, homeScore: 33, awayScore: 30, overtime: true };
  const d = adaptBeatStory({
    ...story,
    headline: 'Chiefs Defeat Broncos 31-10',
    game: beatGameMetadata(final, 'KC'),
  });
  assert.deepEqual(d.graphic, {
    family: 'game-result',
    leftTeam: 'DEN',
    rightTeam: 'KC',
    leftScore: 30,
    rightScore: 33,
    final: 'FINAL · OT',
  });
});
test('enrichment retains list/scouting identity while attaching schedule metadata', () => {
  const d = adaptBeatStory({
    ...story,
    headline: '10 Quick Facts Following Chiefs Win',
    game: beatGameMetadata(game, 'KC'),
  });
  assert.equal(d.graphic.family, 'numbered');
  assert.equal(d.game?.gameId, 'g1');
});
test('unresolved reliable pairs preserve simplified matchup', () => {
  const d = adaptBeatStory(story);
  assert.equal(d.graphic.family, 'game-matchup');
  assert.equal(d.game, undefined);
});
test('division matchup and historical comparison year are not playoff/season hints', () => {
  const raiders = {
    ...game,
    id: 'lv',
    homeTeam: 'LAC',
    awayTeam: 'LV',
    week: 2,
    kickoffAt: '2026-09-20T20:05:00Z',
  };
  const base = {
    ...story,
    teamAbbr: 'LV',
    publishedAt: '2026-09-18T12:00:00Z',
    summary: 'Raiders visit the Chargers.',
  };
  assert.equal(
    resolveStoryGame(
      {
        ...base,
        headline:
          'Game Preview: Divisional matchup on deck as Raiders head to L.A. to take on Chargers',
      },
      [raiders],
    ).gameId,
    'lv',
  );
  assert.equal(
    resolveStoryGame(
      { ...base, headline: 'Key Matchups: Raiders chasing first win at SoFi Stadium since 2020' },
      [raiders],
    ).gameId,
    'lv',
  );
});
test('ordinary words are not case-insensitive team abbreviations', () => {
  const washington = { ...game, awayTeam: 'WAS' };
  assert.equal(
    resolveStoryGame(
      {
        ...story,
        teamAbbr: 'KC',
        headline: 'That was the game',
        summary: 'The late turnover was costly.',
      },
      [washington],
    ).confidence,
    'unresolved',
  );
});
