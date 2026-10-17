import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  matchSportsbook,
  resolveSportsbookCompatibility,
  defaultSubstitutionPolicy,
  type MatchLeg,
} from './sportsbook-transfer';
const original: MatchLeg = {
  id: 'original',
  eventId: 'game',
  playerId: 'player',
  playerName: 'Player',
  marketType: 'RUSHING_YARDS',
  period: 'game',
  side: 'OVER',
  line: 75.5,
  odds: -110,
  sportsbook: 'FANDUEL',
  available: true,
  kickoffAt: '2099-01-01T00:00:00.000Z',
};
const offer = (patch: Partial<MatchLeg> = {}): MatchLeg => ({
  ...original,
  id: 'offer',
  lineType: 'alternate',
  oddsUpdatedAt: '2026-10-10T00:00:00.000Z',
  ...patch,
});
test('exact matches and book-specific prices, either book or neither', () => {
  const offers = [offer({ odds: -120 }), offer({ id: 'dk', sportsbook: 'DRAFTKINGS', odds: 150 })];
  assert.equal(matchSportsbook([original], offers, 'fanduel')?.estimatedOdds, -120);
  assert.equal(matchSportsbook([original], offers, 'draftkings')?.estimatedOdds, 150);
  assert.equal(matchSportsbook([original], [offers[0]], 'draftkings'), null);
  assert.equal(matchSportsbook([original], [], 'fanduel'), null);
  assert.equal(matchSportsbook([original], [offer({ available: false })], 'fanduel'), null);
});
test('closest threshold first, favorable direction breaks ties, original unchanged', () => {
  const before = JSON.stringify(original);
  const result = matchSportsbook(
    [original],
    [
      offer({ id: 'far', line: 70 }),
      offer({ id: 'harder', line: 76.5 }),
      offer({ id: 'easier', line: 74.5, odds: -150 }),
    ],
    'fanduel',
  )!;
  assert.equal(result.matches[0].selection.id, 'easier');
  assert.equal(result.adjustments, 1);
  assert.equal(result.estimatedOdds, -150);
  assert.equal(JSON.stringify(original), before);
  const under = { ...original, side: 'UNDER' };
  assert.equal(
    matchSportsbook(
      [under],
      [offer({ side: 'UNDER', line: 74.5 }), offer({ id: 'higher', side: 'UNDER', line: 76.5 })],
      'fanduel',
    )!.matches[0].selection.id,
    'higher',
  );
  assert.equal(
    matchSportsbook(
      [original],
      [offer({ id: 'closer', line: 76 }), offer({ line: 74.5 })],
      'fanduel',
    )!.matches[0].selection.id,
    'closer',
  );
});
test('reject wrong identity, period, game, side, market and invalid availability', () => {
  for (const patch of [
    { playerId: 'different' },
    { eventId: 'different' },
    { side: 'UNDER' },
    { period: 'half' },
    { marketType: 'PASSING_YARDS' },
    { odds: null },
    { odds: 0 },
    { line: NaN },
    { kickoffAt: '2098-01-01T00:00:00.000Z' },
  ])
    assert.equal(matchSportsbook([original], [offer(patch)], 'fanduel'), null);
  assert.equal(
    matchSportsbook([{ ...original, kickoffAt: '2000-01-01T00:00:00Z' }], [offer()], 'fanduel'),
    null,
  );
  assert.equal(matchSportsbook([original, original], [offer()], 'fanduel'), null);
  assert.equal(
    matchSportsbook(
      [original, { ...original, id: 'other', playerId: 'other' }],
      [offer()],
      'fanduel',
    ),
    null,
  );
});
test('market-specific limits, extreme odds and unknown alternate classifications', () => {
  assert.equal(matchSportsbook([original], [offer({ line: 50, odds: -1000 })], 'fanduel'), null);
  assert.equal(matchSportsbook([original], [offer({ line: 74.5, odds: -900 })], 'fanduel'), null);
  assert.equal(
    matchSportsbook([original], [offer({ line: 74.5, lineType: 'unknown' })], 'fanduel'),
    null,
  );
  const rec = { ...original, marketType: 'RECEPTIONS', line: 5.5 };
  assert.equal(
    matchSportsbook([rec], [offer({ marketType: 'RECEPTIONS', line: 3.5 })], 'fanduel'),
    null,
  );
  assert.equal(
    matchSportsbook([original], [offer({ line: 74.5 })], 'fanduel', {
      ...defaultSubstitutionPolicy,
      differences: { RUSHING_YARDS: 0 },
    }),
    null,
  );
});
test('available score then freshness rank equal candidates; complete slip estimate uses matched odds', () => {
  const best = offer({ id: 'fresh', line: 74.5, trend: { trendScore: 80 } });
  assert.equal(
    matchSportsbook(
      [original],
      [offer({ id: 'low', line: 74.5, trend: { trendScore: 70 } }), best],
      'fanduel',
    )!.matches[0].selection.id,
    'fresh',
  );
  const second = { ...original, id: 'two', eventId: 'two', playerId: 'two' };
  const result = matchSportsbook(
    [original, second],
    [offer({ odds: 100 }), { ...second, odds: 100 }],
    'fanduel',
  )!;
  assert.equal(result.estimatedOdds, 300);
});

test('four books match only their stored prices and independently require complete availability', async () => {
  const { sportsbooks, sportsbookConfig } = await import('./sportsbook-transfer');
  const offers = sportsbooks.map((book, i) =>
    offer({ id: book, sportsbook: sportsbookConfig[book].stored, odds: 100 + 10 * i }),
  );
  assert.deepEqual(
    sportsbooks.map((b) => sportsbookConfig[b].name),
    ['BetMGM', 'Caesars', 'DraftKings', 'FanDuel'],
  );
  for (const [i, book] of sportsbooks.entries()) {
    assert.equal(matchSportsbook([original], offers, book)?.estimatedOdds, 100 + 10 * i);
    assert.equal(
      matchSportsbook(
        [original],
        offers.filter((l) => l.sportsbook !== sportsbookConfig[book].stored),
        book,
      ),
      null,
    );
    const adjusted = matchSportsbook(
      [original],
      [offer({ sportsbook: sportsbookConfig[book].stored, line: 74.5 })],
      book,
    )!;
    assert.equal(adjusted.adjustments, 1);
    assert.equal(adjusted.matches[0].original.line, 75.5);
  }
});

test('Unabated eligibility never depends on a stored provider deep link', async () => {
  const { sportsbooks, sportsbookConfig } = await import('./sportsbook-transfer');
  const { transferEligibility } = await import('./fanduel-transfer');
  for (const book of sportsbooks) {
    for (const deeplink of [undefined, null, '', 'https://untrusted.example/not-a-selection']) {
      const selected = { ...original, sportsbook: sportsbookConfig[book].stored, deeplink };
      const proposal = matchSportsbook([selected], [offer({ ...selected })], book);
      assert(proposal, `${book}: missing or unusable stored URL must not prevent generation`);
      assert.equal(proposal.adjustments, 0);
      assert.equal(
        transferEligibility(
          proposal.matches.map((m) => m.selection),
          book,
        ),
        null,
      );
    }
  }
});

test('complete-slip intersection follows adds/removes and never invents missing prices', () => {
  const dkOnly = { ...original, id: 'dk-only', eventId: 'one' };
  const fdOnly = { ...original, id: 'fd-only', eventId: 'two' };
  const both = { ...original, id: 'both', eventId: 'three' };
  const offers = [
    { ...dkOnly, sportsbook: 'DRAFTKINGS', odds: -114 },
    { ...fdOnly, sportsbook: 'FANDUEL', odds: -120 },
    { ...both, sportsbook: 'DRAFTKINGS', odds: 150 },
    { ...both, sportsbook: 'FANDUEL', odds: -130 },
  ];
  for (const [selected, expected] of [
    [[dkOnly], ['draftkings']],
    [[fdOnly], ['fanduel']],
    [[both], ['draftkings', 'fanduel']],
    [[dkOnly, both], ['draftkings']],
    [[fdOnly, both], ['fanduel']],
    [[dkOnly, fdOnly], []],
    [[both], ['draftkings', 'fanduel']],
  ] as [MatchLeg[], string[]][]) {
    const available = (['draftkings', 'fanduel'] as const).filter(
      (b) => resolveSportsbookCompatibility(selected, offers, b, true).compatibility.eligible,
    );
    assert.deepEqual(available, expected);
  }
  assert.equal(matchSportsbook([both], offers, 'draftkings')?.estimatedOdds, 150);
  assert.equal(matchSportsbook([both], offers, 'fanduel')?.estimatedOdds, -130);
  assert.equal(resolveSportsbookCompatibility([both], offers, 'draftkings', false).proposal, null);
  assert.equal(matchSportsbook([original], [], 'fanduel'), null);
});
test('combined-yard stored availability is distinct from unverified transfer support', () => {
  const combined = {
    ...original,
    marketType: 'PASSING_RUSHING_YARDS',
    line: 247.5,
    sportsbook: 'DRAFTKINGS',
  };
  const result = resolveSportsbookCompatibility(
    [combined],
    [{ ...combined, odds: -114 }],
    'draftkings',
    true,
  );
  assert.equal(result.compatibility.storedExactLegs, 1);
  assert.equal(result.compatibility.supported, false);
  assert.equal(result.proposal, null);
});
test('partial slip, unmapped players and expired events are ineligible', () => {
  for (const patch of [
    { playerId: null },
    { playerName: null },
    { kickoffAt: '2000-01-01T00:00:00.000Z' },
    { marketType: 'OTHER' },
  ])
    assert.equal(
      resolveSportsbookCompatibility([{ ...original, ...patch }], [offer()], 'fanduel', true)
        .proposal,
      null,
    );
  const result = resolveSportsbookCompatibility(
    [original],
    [offer()],
    'fanduel',
    true,
    defaultSubstitutionPolicy,
    Date.now(),
    2,
  );
  assert.equal(result.proposal, null);
  assert.equal(result.compatibility.unavailableLegs, 1);
});

test('same-game and mixed-game QA slips require complete book coverage and no independent combined price', () => {
  const second = {
    ...original,
    id: 'second',
    playerId: 'second-player',
    playerName: 'Second Player',
    marketType: 'RECEPTIONS',
    line: 5.5,
  };
  const third = { ...original, id: 'third', eventId: 'other-game' };
  for (const book of ['draftkings', 'fanduel'] as const) {
    const sportsbook = book.toUpperCase();
    for (const selected of [
      [original, second],
      [original, second, third],
    ]) {
      const offers = selected.map((l) => ({ ...l, sportsbook }));
      const result = resolveSportsbookCompatibility(selected, offers, book, true);
      assert.equal(result.compatibility.eligible, true);
      assert.equal(result.proposal?.matches.length, selected.length);
      assert.equal(result.proposal?.estimatedOdds, null);
      assert.equal(matchSportsbook(selected, offers.slice(1), book), null);
    }
  }
});
