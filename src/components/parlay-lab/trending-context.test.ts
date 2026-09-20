import assert from 'node:assert/strict';
import test from 'node:test';
import {
  labScoreTier,
  representativeTrends,
  trendReason,
  compactTrendReason,
} from './trending-context';
test('main lines get a small reference preference, but much stronger alternates can surface', () => {
  const base = {
    eventId: 'a',
    playerId: 'p',
    marketType: 'PASSING_YARDS',
    period: 'game',
    side: 'OVER',
  };
  const main = { ...base, lineType: 'main', trend: { trendScore: 80 } },
    alt = { ...base, lineType: 'alternate', trend: { trendScore: 84 } };
  assert.equal(representativeTrends([alt, main])[0], main);
  const strong = { ...alt, trend: { trendScore: 96 } };
  assert.equal(representativeTrends([main, strong])[0], strong);
  assert.equal(
    representativeTrends([
      main,
      { ...main, side: 'UNDER' },
      { ...main, eventId: 'b' },
      { ...main, period: '1q' },
    ]).length,
    4,
  );
});
test('under reasons use side-aware margins and do not describe value', () => {
  const result = trendReason({
    line: 20,
    side: 'UNDER',
    trend: {
      streakType: 'HIT',
      streakLength: 7,
      last10: { games: 10, hits: 9 },
      recentAverage10: 15,
    },
  });
  assert.equal(result.title, '7 straight under');
  assert.equal(result.detail, '+5 avg below line · L10');
  assert.equal(trendReason({ line: 20, side: 'OVER' }).title, 'Insufficient history');
});
test('display tiers share exact boundaries', () => {
  assert.equal(labScoreTier(90).label, 'HIGH');
  assert.equal(labScoreTier(89).label, 'GOOD');
  assert.equal(labScoreTier(50).label, 'MODERATE');
  assert.equal(labScoreTier(49).label, 'LOW');
});

test('compact reasons keep the actual average direction clear for both sides', () => {
  const trend = {
    streakType: 'HIT',
    streakLength: 8,
    last10: { hits: 9, games: 10 },
    recentAverage10: 15,
  };
  assert.equal(
    compactTrendReason({ trend, line: 20, side: 'UNDER' }),
    '8 straight U · 5 below line',
  );
  assert.equal(
    compactTrendReason({ trend, line: 10, side: 'OVER' }),
    '8 straight O · 5 above line',
  );
  assert.equal(
    compactTrendReason({ trend: { ...trend, streakType: 'MISS' }, line: 20, side: 'OVER' }),
    '9 of last 10 · 5 below line',
  );
});
