import test from 'node:test';
import assert from 'node:assert/strict';
import {
  mockTradeAssets,
  moveUpOfferShare,
  chooseDirectionalOffer,
  evaluateMockPackage,
  executeMockTrade,
  expireMockOffers,
  generateMockTradeOpportunity,
  proposeMockTrade,
  tradeYear,
  type MockTradeOffer,
} from './mock-draft-trades';
import { createSaveState } from '@/server/api/store';
import { createDraftSession, getDraftSession, restoreDraftSession } from '@/server/api/draft';

function setup(seed = 1, team = 'CHI') {
  const saveId = `trade-hub-test-${seed}-${team}`;
  createSaveState(saveId, team);
  const { draftSessionId } = createDraftSession('mock', saveId, 7);
  const session = getDraftSession(draftSessionId, saveId);
  session.rngSeed = seed;
  session.tradeState!.offers = [];
  session.tradeState!.history = [];
  session.tradeState!.evaluatedPicks = [];
  session.tradeState!.lastOfferPick = -10;
  return { session, saveId };
}
test('chart values are user-relative and future values discounted', () => {
  const { session } = setup();
  const assets = mockTradeAssets(session);
  const eight = assets.find((p) => p.overallSlot === 8)!;
  const fifteen = assets.find((p) => p.overallSlot === 15)!;
  const value = evaluateMockPackage([eight], [fifteen], tradeYear(session));
  assert.equal(value.sent, 1400);
  assert.equal(value.received, 1050);
  assert.equal(value.label, 'Poor Value');
  const future = assets.find((p) => p.year === tradeYear(session) + 1 && p.round === 1)!;
  assert.ok(future);
  assert.ok(future.projectedValuePoints < 950);
  assert.equal(future.overallSlot, null);
});
test('trade applies current and future ownership atomically while paused, preserves original owners and snapshot', () => {
  const { session, saveId } = setup(2, 'NYJ');
  session.currentPickIndex = 1;
  session.isPaused = true;
  const assets = mockTradeAssets(session);
  const send = assets.find((p) => p.id === session.picks[1].id)!;
  const receive = assets.find((p) => p.owningTeamAbbr === 'CHI' && p.year === tradeYear(session))!;
  const future = assets.find((p) => p.owningTeamAbbr === 'CHI' && p.year > tradeYear(session))!;
  const offer: MockTradeOffer = {
    id: 'test',
    team: 'CHI',
    intent: 'move_up',
    send: [send.id],
    receive: [receive.id, future.id],
    status: 'active',
    reason: 'test',
    createdPick: 1,
    exchanges: 0,
  };
  session.tradeState!.offers.push(offer);
  executeMockTrade(session, offer);
  assert.equal(session.picks[1].ownerTeamAbbr, 'CHI');
  assert.equal(session.picks[1].originalTeamAbbr, 'NYJ');
  assert.equal(session.currentPickIndex, 1);
  assert.equal(session.isPaused, true);
  assert.equal(mockTradeAssets(session).find((p) => p.id === future.id)?.owningTeamAbbr, 'NYJ');
  assert.throws(() => executeMockTrade(session, offer), /no longer active/);
  const restored = restoreDraftSession(saveId, JSON.parse(JSON.stringify(session)));
  assert.equal(restored.tradeState!.history.length, 1);
  assert.equal(mockTradeAssets(restored).find((p) => p.id === future.id)?.owningTeamAbbr, 'NYJ');
  const before = JSON.stringify(restored);
  assert.throws(
    () =>
      executeMockTrade(restored, {
        ...offer,
        id: 'bad',
        status: 'active',
        send: [receive.id],
        receive: [future.id],
      }),
    /no longer available/,
  );
  assert.equal(JSON.stringify(restored), before);
});
test('offers expire when picks are used or motivation disappears; duplicate assets rejected', () => {
  const { session } = setup(3);
  const assets = mockTradeAssets(session);
  const send = assets.find((p) => p.owningTeamAbbr === 'CHI')!;
  const receive = assets.find((p) => p.owningTeamAbbr === 'NYJ')!;
  const offer: MockTradeOffer = {
    id: 'expiration',
    team: 'NYJ',
    intent: 'move_up',
    send: [send.id],
    receive: [receive.id],
    status: 'active',
    reason: 'test',
    createdPick: 0,
    exchanges: 0,
  };
  session.tradeState!.offers.push(offer);
  session.picks.find((p) => p.id === send.id)!.selectedPlayerId = 'selected';
  expireMockOffers(session);
  assert.equal(offer.status, 'expired');
  assert.throws(() => proposeMockTrade(session, 'NYJ', [receive.id], [receive.id]), /once/);
});
test('proposal decisions are deterministic and counters stop after three exchanges', () => {
  const { session } = setup(4);
  const assets = mockTradeAssets(session);
  const send = assets.filter((p) => p.owningTeamAbbr === 'CHI' && p.year === tradeYear(session));
  const receive = assets.filter((p) => p.owningTeamAbbr === 'NYJ' && p.year === tradeYear(session));
  const clone = structuredClone(session);
  const a = proposeMockTrade(session, 'NYJ', [send[0].id], [receive[0].id]);
  const b = proposeMockTrade(clone, 'NYJ', [send[0].id], [receive[0].id]);
  assert.deepEqual(a, b);
  const prior: MockTradeOffer = {
    id: 'final-counter',
    team: 'NYJ',
    intent: 'move_up',
    send: [send[0].id],
    receive: [receive[0].id],
    status: 'active',
    reason: 'test',
    createdPick: 0,
    exchanges: 2,
  };
  const another = setup(5).session;
  another.tradeState!.offers.push(prior);
  // Resolve fresh IDs in this session, then demand the top pick for a seventh-rounder.
  const fresh = mockTradeAssets(another);
  prior.send = [fresh.find((p) => p.owningTeamAbbr === 'CHI' && p.round === 7)!.id];
  prior.receive = [fresh.find((p) => p.owningTeamAbbr === 'NYJ' && p.round === 1)!.id];
  assert.equal(
    proposeMockTrade(another, 'NYJ', prior.send, prior.receive, prior.id).outcome,
    'declined',
  );
});
test('seeded opportunities vary across rounds and average roughly 3–4 offers', () => {
  const base = setup(6).session;
  let total = 0,
    rounds = 0;
  const counts: number[] = [];
  for (let seed = 1; seed <= 40; seed++) {
    const session = structuredClone(base);
    session.rngSeed = seed;
    session.userTeamAbbr = Object.keys(session.tradeState!.needs)[
      (seed - 1) % Object.keys(session.tradeState!.needs).length
    ];
    session.tradeState!.offers = [];
    session.tradeState!.evaluatedPicks = [];
    session.tradeState!.lastOfferPick = -10;
    for (let index = 0; index < 224; index++) {
      session.currentPickIndex = index;
      generateMockTradeOpportunity(session);
      const prospect = session.prospects
        .filter((p) => !p.isDrafted)
        .sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999))[0];
      if (prospect) {
        prospect.isDrafted = true;
        session.picks[index].selectedPlayerId = prospect.id;
      }
    }
    for (let round = 0; round < 7; round++) {
      const count = session.tradeState!.offers.filter(
        (o) => Math.floor(o.createdPick / 32) === round,
      ).length;
      counts.push(count);
      total += count;
      rounds++;
    }
  }
  const average = total / rounds;
  console.log({ average, min: Math.min(...counts), max: Math.max(...counts) });
  assert.ok(average >= 3 && average <= 4, `Average ${average}`);
  assert.ok(new Set(counts).size > 2);
});

test('trade API accepts stored offers only and rejects expired/replayed acceptance', async () => {
  const { POST } = await import('@/app/api/draft/trade-hub/route');
  const { session, saveId } = setup(71, 'NYJ');
  session.isPaused = true;
  const assets = mockTradeAssets(session);
  const send = assets.find((p) => p.owningTeamAbbr === 'NYJ')!,
    receive = assets.find((p) => p.owningTeamAbbr === 'ARI')!;
  const offer: MockTradeOffer = {
    id: 'api-offer',
    team: 'ARI',
    send: [send.id],
    receive: [receive.id],
    intent: 'move_up',
    status: 'active',
    reason: 'test',
    createdPick: 0,
    exchanges: 0,
  };
  session.tradeState!.offers.push(offer);
  const request = (offerId: string) =>
    new Request('http://localhost/api/draft/trade-hub', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'accept', saveId, draftSessionId: session.id, offerId }),
    });
  assert.equal((await POST(request('not-issued'))).status, 400);
  const result = await (await POST(request(offer.id))).json();
  assert.equal(result.ok, true);
  assert.equal(result.session.isPaused, true);
  assert.equal(result.session.tradeRevision, 1);
  assert.equal((await POST(request(offer.id))).status, 400);
});

test('offer direction favors CPU move-ups early, move-backs late, and a balanced middle', () => {
  const { session } = setup(91);
  const candidates = [
    { intent: 'move_up' as const, score: 0.9 },
    { intent: 'move_down' as const, score: 0.7 },
    { intent: 'move_down' as const, score: 0.2 },
  ];
  for (const [slot, expectedUp] of [
    [5, 3],
    [16, 2],
    [25, 1],
  ]) {
    const fixture = structuredClone(session);
    fixture.picks.forEach((p) => {
      if (p.ownerTeamAbbr === fixture.userTeamAbbr) p.ownerTeamAbbr = 'NYJ';
    });
    fixture.picks[slot - 1].ownerTeamAbbr = fixture.userTeamAbbr;
    const target = mockTradeAssets(fixture).find((p) => p.id === fixture.picks[slot - 1].id)!;
    const previous: Array<{ intent: 'move_up' | 'move_down' }> = [];
    for (let i = 0; i < 4; i++) {
      const chosen = chooseDirectionalOffer(
        candidates,
        moveUpOfferShare(fixture, target),
        previous,
        0.5,
      )!;
      previous.push(chosen);
      if (chosen.intent === 'move_down') assert.equal(chosen.score, 0.7);
    }
    assert.equal(previous.filter((o) => o.intent === 'move_up').length, expectedUp, `Pick ${slot}`);
    // Later rounds must not distort the target round's direction mix.
    fixture.picks
      .filter((p) => p.round > 1)
      .forEach((p) => (p.ownerTeamAbbr = fixture.userTeamAbbr));
    assert.equal(
      moveUpOfferShare(fixture, target),
      moveUpOfferShare({ ...fixture, picks: fixture.picks.filter((p) => p.round === 1) }, target),
    );
  }
});

test('direction preference never invents an unavailable trade or duplicates offers', () => {
  const down = { intent: 'move_down' as const, score: 0.6 };
  assert.equal(chooseDirectionalOffer([down], 0.75, [], 0), down);
  assert.equal(chooseDirectionalOffer([], 0.75, [], 0), undefined);
  const { session } = setup(92);
  generateMockTradeOpportunity(session);
  const snapshot = JSON.stringify(session.tradeState);
  generateMockTradeOpportunity(session);
  assert.equal(JSON.stringify(session.tradeState), snapshot);
});

test('proposal previews are read-only and accepted trades retain their valuation', async () => {
  const { evaluateMockProposal } = await import('./mock-draft-trades');
  const { session } = setup(91, 'NYJ');
  const assets = mockTradeAssets(session);
  const send = assets.find((p) => p.owningTeamAbbr === 'NYJ' && p.overallSlot === 2)!;
  const receive = assets.find((p) => p.owningTeamAbbr === 'ARI' && p.overallSlot === 3)!;
  const before = structuredClone(session);
  const preview = evaluateMockProposal(session, 'ARI', [send.id], [receive.id]);
  assert.deepEqual(session, before);
  assert.equal(preview.acceptable, true);
  assert.equal(proposeMockTrade(session, 'ARI', [send.id], [receive.id]).outcome, 'accepted');
  assert.deepEqual(session.tradeState!.history[0].valuation, preview.value);
});

test('offer presentation disables expired picks without hiding their package', async () => {
  const { presentMockOffer, orderedMockOffers } = await import('./mock-trade-presentation');
  const { session } = setup(92, 'NYJ');
  const offer: MockTradeOffer = {
    id: 'display',
    team: 'ARI',
    intent: 'move_up',
    send: [session.picks[1].id],
    receive: [session.picks[2].id],
    status: 'active',
    reason: 'Move up',
    createdPick: 0,
    exchanges: 0,
  };
  session.tradeState!.offers.push(offer);
  assert.equal(presentMockOffer(session, offer).valid, true);
  assert.match(presentMockOffer(session, offer).expiration, /Pick 2/);
  session.picks[1].selectedPlayerId = session.prospects[0].id;
  const display = orderedMockOffers(session)[0];
  assert.equal(display.valid, false);
  assert.equal(display.status, 'expired');
  assert.equal(display.send[0].overallSlot, 2);
  assert.equal(offer.status, 'active');
});
