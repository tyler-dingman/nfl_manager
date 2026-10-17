import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  validateTestCandidate,
  eligibleTransfer,
  attributedGeneratedUrl,
  generationPrompt,
  type TransferLeg,
} from './test-transfer-validation';
import { generatedSlipSchema, type GeneratedSlip } from './types';
import { UnabatedClient } from './client';
import { fingerprint, quotaReason, transferEnabled, transferLimits } from './transfer-service';
import {
  transferEligibility,
  validTransferUrl,
} from '../../../../packages/parlay/fanduel-transfer';
const audit = JSON.parse(
  readFileSync('src/server/providers/unabated/fixtures/transfer.json', 'utf8'),
);
export const legs: TransferLeg[] = audit.tests[0].pick.legs.map((l: TransferLeg, i: number) => ({
  ...l,
  available: true,
  kickoffAt: `2099-10-${11 + i}T17:00:00.000Z`,
}));
export const slip: GeneratedSlip = generatedSlipSchema.parse(
  audit.tests[0].result.betSlips.find((s: { book: string }) => s.book === 'FanDuel'),
);
slip.betslipBets!.forEach((b) => {
  b.metadata!.timestamp = legs.find((l) => l.playerName === b.player)!.kickoffAt;
});
test('single, three-leg and alternate candidates preserve missing-direction distinction', () => {
  const result = validateTestCandidate(legs, slip, 'IA', 'downanddistance');
  assert.equal(result.directionVerified, false);
  assert(validTransferUrl(result.url));
  for (const l of legs) {
    const b = slip.betslipBets!.find((b) => b.player === l.playerName)!;
    assert(
      validateTestCandidate(
        [l],
        { ...slip, legsRequested: 1, legsMatched: 1, betslipBets: [b] },
        'IA',
        'downanddistance',
      ).url,
    );
  }
  assert.match(generationPrompt(legs, 'IA'), /OVER 0.5 Receptions/);
});
for (const [name, change] of Object.entries({
  threshold: (s: GeneratedSlip): unknown => (s.betslipBets![0].odds!.points = '12.5'),
  player: (s: GeneratedSlip): unknown => (s.betslipBets![0].player = 'Wrong Player'),
  game: (s: GeneratedSlip): unknown => (s.betslipBets![0].event = 'Wrong @ Game'),
  kickoff: (s: GeneratedSlip): unknown =>
    (s.betslipBets![0].metadata!.timestamp = '2098-01-01T00:00:00Z'),
  partial: (s: GeneratedSlip): unknown => (s.legsMatched = 2),
  duplicate: (s: GeneratedSlip): unknown => (s.betslipBets![1] = s.betslipBets![0]),
  market: (s: GeneratedSlip): unknown => (s.betslipBets![0].betType = 'Passing Yards'),
  period: (s: GeneratedSlip): unknown => (s.betslipBets![0].periodType = 'First Half'),
  'direction contradiction': (s: GeneratedSlip): unknown => (s.betslipBets![0].direction = 'OVER'),
  region: (s: GeneratedSlip): unknown =>
    (s.betslipBets![0].metadata!.additionalInfo = { region: 'NJ' }),
  book: (s: GeneratedSlip): unknown => (s.book = 'DraftKings'),
  'invalid URL': (s: GeneratedSlip): unknown =>
    (s.deepLink = 'https://evil.example/deeplink/deeplink-cache-test'),
}))
  test(`reject ${name}`, () => {
    const s = structuredClone(slip);
    change(s);
    assert.throws(() => validateTestCandidate(legs, s, 'IA', 'downanddistance'));
  });
test('eligibility permits same-game QA and rejects duplicates, expired, unsupported and unavailable', () => {
  assert.throws(() => eligibleTransfer([legs[0], legs[0]]));
  assert.equal(transferEligibility([legs[0], { ...legs[1], eventId: legs[0].eventId }]), null);
  for (const patch of [
    { available: false },
    { marketType: 'OTHER' },
    { playerId: null },
    { kickoffAt: '2000-01-01T00:00:00Z' },
  ])
    assert.throws(() => eligibleTransfer([{ ...legs[0], ...patch } as TransferLeg]));
  assert.throws(() => generationPrompt(legs, 'NJ'));
});
test('attribution preserves other parameters, rejects wrong attribution and unsafe URLs', () => {
  const url = 'https://gambly.com/deeplink/deeplink-cache-test?x=1';
  const out = attributedGeneratedUrl(url, 'downanddistance');
  assert.equal(new URL(out).searchParams.get('x'), '1');
  assert.equal(attributedGeneratedUrl(out, 'downanddistance'), out);
  for (const url of [
    'javascript:alert(1)',
    'https://gambly.com.evil.test/deeplink/deeplink-cache-x',
    'https://x@gambly.com/deeplink/deeplink-cache-x',
    'https://gambly.com:444/deeplink/deeplink-cache-x',
    out.replace('downanddistance', 'other'),
  ])
    assert.throws(() => attributedGeneratedUrl(url, 'downanddistance'));
});
test('feature cannot activate in production; auth allowlist required', () => {
  const env = {
    NODE_ENV: 'development',
    ENABLE_FANDUEL_BETSLIP: 'true',
    ENABLE_UNABATED_INGESTION: 'false',
    ODDS_PROVIDER: 'sportsgameodds',
    UNABATED_API_KEY: 'fixture',
    UNABATED_PARTNER_CODE: 'test',
    FANDUEL_TEST_USER_IDS: 'one',
  } as NodeJS.ProcessEnv;
  assert(transferEnabled('one', env));
  assert(!transferEnabled('two', env));
  assert(!transferEnabled('one', { ...env, NODE_ENV: 'production' }));
});
test('quota and idempotency keys', () => {
  assert.equal(fingerprint(['b', 'a'], 'IA'), fingerprint(['a', 'b'], 'IA'));
  assert.notEqual(fingerprint(['a'], 'IA'), fingerprint(['a'], 'NJ'));
  assert(quotaReason({ user: 5, global: 5, active: 0 }, { user: 5, global: 50, concurrent: 3 }));
  assert(quotaReason({ user: 0, global: 50, active: 0 }, { user: 5, global: 50, concurrent: 3 }));
  assert(quotaReason({ user: 0, global: 0, active: 3 }, { user: 5, global: 50, concurrent: 3 }));
});
test('generation POST and status failures never retry', async () => {
  for (const mode of ['timeout', '429']) {
    let calls = 0;
    const c = new UnabatedClient({
      apiKey: 'fixture',
      fetcher: async () => {
        calls++;
        if (mode === 'timeout') throw Error('timeout');
        return new Response('{}', { status: 429 });
      },
    });
    await assert.rejects(c.generateSlip('fixture'));
    assert.equal(calls, 1);
    await assert.rejects(c.slipStatus('00000000-0000-4000-8000-000000000001'));
    assert.equal(calls, 2);
  }
});

test('region-neutral generation preserves exact selections and rejects unresolved regional results', () => {
  const prompt = generationPrompt(legs);
  assert.doesNotMatch(prompt, /Iowa|Region:/);
  for (const leg of legs) assert(prompt.includes(`${leg.side} ${leg.line}`));
  assert(validTransferUrl(validateTestCandidate(legs, slip, 'UNSPECIFIED', 'downanddistance').url));
  for (const region of ['IA', 'NJ', 'Iowa']) {
    const regional = structuredClone(slip);
    regional.betslipBets![0].metadata!.additionalInfo = { region };
    assert.throws(
      () => validateTestCandidate(legs, regional, 'UNSPECIFIED', 'downanddistance'),
      /region-specific/,
    );
  }
});

test('DraftKings validates exact thresholds independently of FanDuel and refuses provider substitutions', () => {
  const dkLegs = legs.map((l) => ({ ...l, sportsbook: 'DRAFTKINGS' }));
  const dk = structuredClone(slip);
  dk.book = 'DraftKings';
  dk.betslipBets!.forEach((b) => (b.deepLink!.sportsbook = 'DraftKings'));
  assert(validateTestCandidate(dkLegs, dk, 'UNSPECIFIED', 'downanddistance', 'draftkings').url);
  assert.match(generationPrompt(dkLegs, 'UNSPECIFIED', 'draftkings'), /ONE DraftKings/);
  dk.betslipBets![1].odds!.points = '1.5';
  assert.throws(
    () => validateTestCandidate(dkLegs, dk, 'UNSPECIFIED', 'downanddistance', 'draftkings'),
    /threshold/,
  );
});
test('DraftKings has an independent flag and the same allowlist and production exclusion', () => {
  const env = {
    NODE_ENV: 'development',
    ODDS_PROVIDER: 'sportsgameodds',
    ENABLE_UNABATED_INGESTION: 'false',
    ENABLE_FANDUEL_BETSLIP: 'true',
    ENABLE_DRAFTKINGS_BETSLIP: 'false',
    UNABATED_API_KEY: 'fixture',
    UNABATED_PARTNER_CODE: 'fixture',
    FANDUEL_TEST_USER_IDS: 'user',
  } as NodeJS.ProcessEnv;
  assert(transferEnabled('user', env, 'fanduel'));
  assert(!transferEnabled('user', env, 'draftkings'));
  env.ENABLE_DRAFTKINGS_BETSLIP = 'true';
  assert(transferEnabled('user', env, 'draftkings'));
  assert(!transferEnabled('other', env, 'draftkings'));
  assert(!transferEnabled('user', { ...env, NODE_ENV: 'production' }, 'draftkings'));
  assert.notEqual(
    fingerprint(['x'], 'UNSPECIFIED', 'fanduel'),
    fingerprint(['x'], 'UNSPECIFIED', 'draftkings'),
  );
});

for (const book of ['betmgm', 'caesars'] as const) {
  test(`${book}: fixture complete slips, strict mismatch rejection and independent local flag`, async () => {
    const { sportsbookConfig } = await import('../../../../packages/parlay/sportsbook-transfer');
    const config = sportsbookConfig[book];
    const selected = legs.map((l) => ({ ...l, sportsbook: config.stored }));
    const candidate = structuredClone(slip);
    candidate.book = config.unabatedName;
    candidate.betslipBets!.forEach((b) => {
      b.deepLink!.sportsbook = config.unabatedName;
    });
    const result = validateTestCandidate(
      selected,
      candidate,
      'UNSPECIFIED',
      'downanddistance',
      book,
    );
    assert.equal(result.directionVerified, false);
    assert(validTransferUrl(result.url, book));
    assert.equal(new URL(result.url).searchParams.get('utm_campaign'), 'downanddistance');
    for (const mutate of [
      (s: GeneratedSlip) => {
        s.legsMatched = 1;
      },
      (s: GeneratedSlip) => {
        s.betslipBets![0].odds!.points = '999';
      },
      (s: GeneratedSlip) => {
        s.book = 'FanDuel';
      },
      (s: GeneratedSlip) => {
        s.betslipBets![0].metadata!.additionalInfo = { region: 'IA' };
      },
      (s: GeneratedSlip) => {
        s.betslipBets![1] = s.betslipBets![0];
      },
    ]) {
      const invalid = structuredClone(candidate);
      mutate(invalid);
      assert.throws(() =>
        validateTestCandidate(selected, invalid, 'UNSPECIFIED', 'downanddistance', book),
      );
    }
    const env: NodeJS.ProcessEnv = {
      NODE_ENV: 'test',
      ODDS_PROVIDER: 'sportsgameodds',
      ENABLE_UNABATED_INGESTION: 'false',
      UNABATED_API_KEY: 'fixture',
      UNABATED_PARTNER_CODE: 'fixture',
      FANDUEL_TEST_USER_IDS: 'user',
    };
    assert(!transferEnabled('user', env, book));
    env[config.flag] = 'true';
    assert(transferEnabled('user', env, book));
    assert(!transferEnabled('other', env, book));
    assert(!transferEnabled('user', { ...env, NODE_ENV: 'production' }, book));
  });
}

test('supported statistical markets require destination pricing and retain exact validation', async () => {
  const { transferMarkets } = await import('../../../../packages/parlay/transfer-markets');
  for (const [marketType, label] of Object.entries(transferMarkets)) {
    if (marketType === 'PASSING_RUSHING_YARDS') continue;
    const selected: TransferLeg = {
      ...legs[0],
      marketType,
      line: 1.5,
      odds: -120,
      available: true,
      pricingStatus: 'stored',
    };
    assert.equal(transferEligibility([selected]), null);
    assert(
      transferEligibility([
        { ...selected, available: false, odds: null, pricingStatus: 'unknown' },
      ]),
    );
    const bet = structuredClone(slip.betslipBets![0]);
    bet.player = selected.playerName;
    bet.betType = label;
    bet.odds!.points = '1.5';
    const candidate = { ...slip, legsRequested: 1, legsMatched: 1, betslipBets: [bet] };
    assert(validateTestCandidate([selected], candidate, 'UNSPECIFIED', 'downanddistance').url);
    assert(generationPrompt([selected]).includes(label));
    bet.odds!.points = '2.5';
    assert.throws(
      () => validateTestCandidate([selected], candidate, 'UNSPECIFIED', 'downanddistance'),
      /threshold/,
    );
    bet.odds!.points = '1.5';
    bet.betType = 'Wrong statistical market';
    assert.throws(
      () => validateTestCandidate([selected], candidate, 'UNSPECIFIED', 'downanddistance'),
      /market/,
    );
  }
});

test('per-user test quota permits 50 generations and still respects lower configured caps', () => {
  const key = 'UNABATED_MAX_GENERATIONS_PER_USER_DAY';
  const previous = process.env[key];
  try {
    delete process.env[key];
    assert.equal(transferLimits().user, 50);
    process.env[key] = '50';
    const limits = { ...transferLimits(), global: 50, concurrent: 3 };
    assert.equal(quotaReason({ user: 49, global: 49, active: 0 }, limits), null);
    assert(quotaReason({ user: 50, global: 50, active: 0 }, limits));
    process.env[key] = '100';
    assert.equal(transferLimits().user, 50);
    process.env[key] = '2';
    assert.equal(transferLimits().user, 2);
  } finally {
    if (previous === undefined) delete process.env[key];
    else process.env[key] = previous;
  }
});

test('same-game and mixed slips validate every leg and reject partial or altered results', () => {
  for (const book of ['fanduel', 'draftkings'] as const) {
    const same = legs.map((l, i) => ({
      ...l,
      sportsbook: book.toUpperCase(),
      ...(i < 2
        ? {
            eventId: legs[0].eventId,
            kickoffAt: legs[0].kickoffAt,
            homeTeamId: legs[0].homeTeamId,
            awayTeamId: legs[0].awayTeamId,
          }
        : {}),
    }));
    const result = structuredClone(slip);
    result.book = book === 'fanduel' ? 'FanDuel' : 'DraftKings';
    result.betslipBets!.forEach((b) => {
      const l = same.find((l) => l.playerName === b.player)!;
      b.event = `${l.awayTeamId} @ ${l.homeTeamId}`;
      b.metadata!.timestamp = l.kickoffAt;
      b.deepLink!.sportsbook = result.book!;
    });
    assert.match(generationPrompt(same, 'UNSPECIFIED', book), /same-game selections together/);
    assert(validateTestCandidate(same, result, 'UNSPECIFIED', 'downanddistance', book).url);
    const partial = structuredClone(result);
    partial.betslipBets!.pop();
    assert.throws(() =>
      validateTestCandidate(same, partial, 'UNSPECIFIED', 'downanddistance', book),
    );
    const changed = structuredClone(result);
    changed.betslipBets![0].odds!.points = '999';
    assert.throws(() =>
      validateTestCandidate(same, changed, 'UNSPECIFIED', 'downanddistance', book),
    );
  }
});
