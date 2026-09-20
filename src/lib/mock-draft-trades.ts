import { createRng } from '@/lib/deterministic-rng';
import { getPickTradeValue, getFuturePickTradeValue, TRADE_CHART_CONFIG } from '@/lib/trade-chart';
import type { DraftSessionDTO } from '@/types/draft';
import type { TradePickAssetDTO } from '@/types/trade-offers';

export const MOCK_TRADE_CONFIG = {
  futureDiscount: [1, 0.82, 0.7],
  valueLabels: { great: 1.1, good: 1.02, fair: 0.94 },
  baseChance: 0.12,
  cooldownPicks: 2,
  teamCooldownPicks: 12,
  maxAssets: 3,
  maxExchanges: 3,
  maxDistance: 40,
  proposalMaxRatio: 1.5,
  proposalMinRatio: 0.65,
  acceptanceMotivationBonus: 0.16,
  acceptanceSensitivityPenalty: 0.05,
  counterTolerance: 0.06,
  proximityBonus: 0.09,
  directionalMinorityShare: 0.25,
  minRatio: 0.9,
  maxRatio: 1.1,
  motivatedMaxRatio: 1.2,
  premiumPositions: ['QB', 'OT', 'EDGE', 'WR', 'CB'],
};
export type MockTradeOffer = {
  id: string;
  team: string;
  intent: 'move_up' | 'move_down';
  send: string[];
  receive: string[];
  status: 'active' | 'accepted' | 'declined' | 'expired' | 'countered';
  reason: string;
  prospectId?: string;
  originalPackage?: { send: string[]; receive: string[] };
  targetPickId?: string;
  createdPick: number;
  exchanges: number;
};
export type MockTradeState = {
  futurePicks: TradePickAssetDTO[];
  needs: Record<string, string[]>;
  offers: MockTradeOffer[];
  history: Array<{
    id: string;
    team: string;
    pick: number;
    valuation?: ReturnType<typeof evaluateMockPackage>;
    send: TradePickAssetDTO[];
    receive: TradePickAssetDTO[];
  }>;
  evaluatedPicks: number[];
  lastOfferPick: number;
};
export const tradeYear = (session: DraftSessionDTO) => session.draftYear ?? 2027;
export function pickValue(pick: TradePickAssetDTO, year: number) {
  const yearsOut = pick.year - year;
  const discount = MOCK_TRADE_CONFIG.futureDiscount[yearsOut];
  if (discount === undefined) return 0;
  return yearsOut > 0
    ? getFuturePickTradeValue({ ...pick, overallSlot: null }, yearsOut, pick.round)
    : getPickTradeValue(pick);
}
export function mockTradeAssets(
  session: DraftSessionDTO,
  includeUsed = false,
): TradePickAssetDTO[] {
  const year = tradeYear(session);
  return [
    ...session.picks
      .filter(
        (p, index) => includeUsed || (!p.selectedPlayerId && index >= session.currentPickIndex),
      )
      .map(
        (p): TradePickAssetDTO => ({
          id: p.id,
          type: 'pick',
          year,
          round: p.round,
          overallSlot: p.overall,
          owningTeamAbbr: p.ownerTeamAbbr,
          originalTeamAbbr: p.originalTeamAbbr,
          label: `${year} · Round ${p.round} · Pick ${p.overall}`,
          futureDiscount: 1,
          projectedValuePoints: getPickTradeValue({ round: p.round, overallSlot: p.overall }),
        }),
      ),
    ...(session.tradeState?.futurePicks ?? []).map((p) => ({
      ...p,
      overallSlot: null,
      label: `${p.year} · Round ${p.round}`,
      projectedValuePoints: pickValue(p, year),
      futureDiscount: MOCK_TRADE_CONFIG.futureDiscount[p.year - year] ?? 0,
    })),
  ];
}
export function evaluateMockPackage(
  send: TradePickAssetDTO[],
  receive: TradePickAssetDTO[],
  year: number,
) {
  const sent = send.reduce((sum, p) => sum + pickValue(p, year), 0);
  const received = receive.reduce((sum, p) => sum + pickValue(p, year), 0);
  const ratio = sent > 0 ? received / sent : 0;
  const labels = MOCK_TRADE_CONFIG.valueLabels;
  return {
    sent,
    received,
    ratio,
    difference: received - sent,
    label:
      ratio >= labels.great
        ? 'Great Value'
        : ratio >= labels.good
          ? 'Good Value'
          : ratio >= labels.fair
            ? 'Fair Value'
            : 'Poor Value',
  };
}
export function resolveMockPackage(
  session: DraftSessionDTO,
  team: string,
  send: string[],
  receive: string[],
) {
  if (team === session.userTeamAbbr || !session.tradeState?.needs[team])
    throw new Error('Choose another team.');
  if (
    !send.length ||
    !receive.length ||
    send.length > MOCK_TRADE_CONFIG.maxAssets ||
    receive.length > MOCK_TRADE_CONFIG.maxAssets
  )
    throw new Error('Choose 1–3 picks on each side.');
  const ids = [...send, ...receive];
  if (new Set(ids).size !== ids.length) throw new Error('A pick can only appear once in a trade.');
  const assets = mockTradeAssets(session);
  const resolve = (list: string[], owner: string) =>
    list.map((id) => {
      const pick = assets.find((p) => p.id === id && p.owningTeamAbbr === owner);
      if (!pick || pickValue(pick, tradeYear(session)) <= 0)
        throw new Error('A pick is no longer available or owned by this team.');
      return pick;
    });
  return { send: resolve(send, session.userTeamAbbr), receive: resolve(receive, team) };
}
export function expireMockOffers(session: DraftSessionDTO) {
  for (const offer of session.tradeState?.offers ?? []) {
    if (offer.status !== 'active') continue;
    try {
      resolveMockPackage(session, offer.team, offer.send, offer.receive);
      if (
        session.status === 'completed' ||
        (offer.prospectId && session.prospects.find((p) => p.id === offer.prospectId)?.isDrafted)
      )
        offer.status = 'expired';
    } catch {
      offer.status = 'expired';
    }
  }
}
export function tradePersonality(session: DraftSessionDTO, team: string) {
  const rng = createRng(`${session.rngSeed}:trade:${team}`);
  return {
    aggression: rng(),
    valueSensitivity: rng(),
    moveUp: rng(),
    futurePreference: rng(),
    premiumAggression: rng(),
  };
}
function motivation(session: DraftSessionDTO, team: string, target: number, own: number) {
  const filledPositions = new Set(
    session.picks
      .filter((p) => p.selectedPlayerId && (p.selectedByTeamAbbr ?? p.ownerTeamAbbr) === team)
      .map((p) => session.prospects.find((player) => player.id === p.selectedPlayerId)?.position),
  );
  const needs = (session.tradeState?.needs[team] ?? []).filter(
    (position) => !filledPositions.has(position),
  );
  const prospects = session.prospects
    .filter((p) => !p.isDrafted)
    .sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999));
  const best =
    prospects.slice(0, 12).find((p) => needs.slice(0, 3).includes(p.position)) ?? prospects[0];
  if (!best) return { score: 0, reason: 'Adding draft capital.', prospectId: undefined };
  const need = needs.slice(0, 3).includes(best.position);
  const premium = MOCK_TRADE_CONFIG.premiumPositions.includes(best.position);
  const fall = Math.max(0, target - (best.rank ?? target));
  const tierEdge = Math.max(0, own - (best.rank ?? own));
  const traits = tradePersonality(session, team);
  const score = Math.min(
    1,
    (need ? 0.3 : 0) +
      (premium ? 0.15 + traits.premiumAggression * 0.1 : 0) +
      Math.min(0.2, fall / 60) +
      Math.min(0.2, tierEdge / 100) +
      traits.aggression * 0.05,
  );
  return {
    score,
    reason: `${best.firstName} ${best.lastName} is available${need ? ` at a position of need (${best.position})` : ` in a stronger talent tier`}.`,
    prospectId: best.id,
  };
}
// Search small, comprehensible packages, using the existing chart rather than pick counts.
function balance(
  session: DraftSessionDTO,
  send: TradePickAssetDTO[],
  receive: TradePickAssetDTO[],
  team: string,
  targetRatio: number,
) {
  const assets = mockTradeAssets(session);
  let best: { send: TradePickAssetDTO[]; receive: TradePickAssetDTO[]; distance: number } | null =
    null;
  const initial = evaluateMockPackage(send, receive, tradeYear(session));
  const addingReceive = initial.ratio < targetRatio;
  const base = addingReceive ? receive : send;
  const extras = assets.filter(
    (p) =>
      p.owningTeamAbbr === (addingReceive ? team : session.userTeamAbbr) &&
      ![...send, ...receive].some((a) => a.id === p.id) &&
      (p.year > tradeYear(session) ||
        (p.overallSlot ?? 0) >
          Math.max(
            ...[...send, ...receive]
              .filter((a) => a.year === tradeYear(session))
              .map((a) => a.overallSlot ?? 0),
          )),
  );
  const candidates = [
    [],
    ...extras.map((p) => [p]),
    ...extras.flatMap((p, i) => extras.slice(i + 1).map((q) => [p, q])),
  ];
  for (const extra of candidates) {
    if (base.length + extra.length > MOCK_TRADE_CONFIG.maxAssets) continue;
    const outgoing = addingReceive ? send : [...send, ...extra];
    const incoming = addingReceive ? [...receive, ...extra] : receive;
    const value = evaluateMockPackage(outgoing, incoming, tradeYear(session));
    const futureCount = extra.filter((p) => p.year > tradeYear(session)).length;
    const distance =
      Math.abs(value.ratio - targetRatio) +
      extra.length * 0.002 +
      futureCount * (1 - tradePersonality(session, team).futurePreference) * 0.003;
    if (!best || distance < best.distance) best = { send: outgoing, receive: incoming, distance };
  }
  return best;
}
// Intent is always the CPU team's direction. Use the target round's ownership,
// not later rounds or only the slots that happen to remain at this instant.
export function moveUpOfferShare(session: DraftSessionDTO, target: TradePickAssetDTO) {
  if (target.year !== tradeYear(session) || target.overallSlot === null) return 0;
  const otherPicks = session.picks.filter(
    (p) => p.round === target.round && p.ownerTeamAbbr !== session.userTeamAbbr,
  );
  const ahead = otherPicks.filter((p) => p.overall < target.overallSlot!).length;
  const behind = otherPicks.filter((p) => p.overall > target.overallSlot!).length;
  if (!ahead) return 1;
  if (!behind) return 0;
  const minority = MOCK_TRADE_CONFIG.directionalMinorityShare;
  return Math.max(minority, Math.min(1 - minority, behind / (ahead + behind)));
}

export function chooseDirectionalOffer<
  T extends { intent: 'move_up' | 'move_down'; score: number },
>(
  candidates: T[],
  moveUpShare: number,
  previous: Array<{ intent: 'move_up' | 'move_down' }>,
  roll: number,
): T | undefined {
  // Balance issued offers over time without imposing a quota or manufacturing packages.
  const upCount = previous.filter((offer) => offer.intent === 'move_up').length;
  const upChance = Math.max(0, Math.min(1, moveUpShare * (previous.length + 1) - upCount));
  const direction = roll < upChance ? 'move_up' : 'move_down';
  const ranked = candidates.slice().sort((a, b) => b.score - a.score);
  return ranked.find((candidate) => candidate.intent === direction) ?? ranked[0];
}

export function generateMockTradeOpportunity(session: DraftSessionDTO) {
  const state = session.tradeState;
  if (!state) return;
  expireMockOffers(session);
  const index = session.currentPickIndex;
  if (session.status !== 'in_progress' || state.evaluatedPicks.includes(index)) return;
  state.evaluatedPicks.push(index);
  if (index - state.lastOfferPick < MOCK_TRADE_CONFIG.cooldownPicks) return;
  const current = session.picks[index];
  if (!current || current.round > session.maxRounds) return;
  const assets = mockTradeAssets(session);
  const user = assets.filter(
    (p) =>
      p.owningTeamAbbr === session.userTeamAbbr &&
      p.year === tradeYear(session) &&
      p.round <= session.maxRounds,
  );
  // Teams without remaining current-year selections can still buy back into the draft.
  const nextUser =
    user[0] ??
    assets
      .filter((p) => p.owningTeamAbbr === session.userTeamAbbr && p.year > tradeYear(session))
      .sort(
        (a, b) =>
          Math.abs(a.round - current.round) - Math.abs(b.round - current.round) || a.year - b.year,
      )[0];
  if (!nextUser) return;
  const rng = createRng(`${session.rngSeed}:offer:${index}`);
  const proximity = (nextUser.overallSlot ?? 999) - current.overall;
  const chance =
    MOCK_TRADE_CONFIG.baseChance + (proximity <= 6 ? MOCK_TRADE_CONFIG.proximityBonus : 0);
  if (rng() > chance) return;
  const candidates: Array<{
    team: string;
    intent: 'move_up' | 'move_down';
    send: TradePickAssetDTO[];
    receive: TradePickAssetDTO[];
    reason: string;
    score: number;
    prospectId?: string;
  }> = [];
  for (const team of Object.keys(state.needs)) {
    if (
      team === session.userTeamAbbr ||
      state.offers.some(
        (o) => o.team === team && index - o.createdPick < MOCK_TRADE_CONFIG.teamCooldownPicks,
      )
    )
      continue;
    const cpuPicks = assets.filter(
      (p) =>
        p.owningTeamAbbr === team && p.year === tradeYear(session) && p.round <= session.maxRounds,
    );
    for (const cpu of cpuPicks.slice(0, 2)) {
      const futureOnly = nextUser.year > tradeYear(session);
      if (futureOnly && (cpu.overallSlot ?? 999) - current.overall > 12) continue;
      const distance = futureOnly ? -1 : (cpu.overallSlot ?? 0) - (nextUser.overallSlot ?? 0);
      if (!distance || Math.abs(distance) > MOCK_TRADE_CONFIG.maxDistance) continue;
      const intent = distance > 0 ? 'move_up' : 'move_down';
      const m = motivation(
        session,
        team,
        nextUser.overallSlot ?? current.overall,
        cpu.overallSlot!,
      );
      const traits = tradePersonality(session, team);
      const pool = session.prospects
        .filter((p) => !p.isDrafted)
        .sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999));
      const flatTier = pool.length > 3 && (pool[3].rank ?? 999) - (pool[0].rank ?? 999) <= 6;
      const capital = cpuPicks.length;
      if (intent === 'move_up' && m.score < 0.2) continue;
      if (intent === 'move_down' && m.score > 0.85 && !flatTier) continue;
      const target = intent === 'move_up' ? 0.98 + m.score * 0.14 : 0.95 + traits.aggression * 0.05;
      const pkg = balance(session, [nextUser], [cpu], team, target);
      if (!pkg) continue;
      const ratio = evaluateMockPackage(pkg.send, pkg.receive, tradeYear(session)).ratio;
      if (
        ratio < MOCK_TRADE_CONFIG.minRatio ||
        ratio > (m.score > 0.7 ? MOCK_TRADE_CONFIG.motivatedMaxRatio : MOCK_TRADE_CONFIG.maxRatio)
      )
        continue;
      if (
        state.offers.some(
          (o) =>
            o.team === team &&
            o.send.join() === pkg.send.map((p) => p.id).join() &&
            o.receive.join() === pkg.receive.map((p) => p.id).join(),
        )
      )
        continue;
      candidates.push({
        team,
        intent,
        send: pkg.send,
        receive: pkg.receive,
        reason:
          intent === 'move_up'
            ? m.reason
            : `A similar prospect tier remains; moving back adds capital${capital < 3 ? ' to a limited pick inventory' : ''}.`,
        prospectId: intent === 'move_up' ? m.prospectId : undefined,
        score:
          (intent === 'move_up'
            ? m.score + traits.moveUp * 0.1
            : (flatTier ? 0.65 : 0.3) + (capital < 3 ? 0.15 : 0)) +
          rng() * 0.2 -
          pkg.distance,
      });
    }
  }
  const previous = state.offers.filter((offer) => offer.targetPickId === nextUser.id);
  const best = chooseDirectionalOffer(
    candidates,
    moveUpOfferShare(session, nextUser),
    previous,
    createRng(`${session.rngSeed}:offer-direction:${index}:${nextUser.id}`)(),
  );
  if (!best) return;
  state.offers.push({
    id: `offer-${session.id}-${index}`,
    targetPickId: nextUser.id,
    team: best.team,
    intent: best.intent,
    send: best.send.map((p) => p.id),
    receive: best.receive.map((p) => p.id),
    reason: best.reason,
    prospectId: best.prospectId,
    status: 'active',
    createdPick: index,
    exchanges: 0,
  });
  state.lastOfferPick = index;
}
export function executeMockTrade(session: DraftSessionDTO, offer: MockTradeOffer) {
  if (session.mode !== 'mock' || session.status !== 'in_progress' || !session.tradeState)
    throw new Error('No active mock draft.');
  expireMockOffers(session);
  if (offer.status !== 'active') throw new Error('This offer is no longer active.');
  const resolved = resolveMockPackage(session, offer.team, offer.send, offer.receive);
  // All validation completes before any mutation. This synchronous transaction never advances the clock.
  const owners = new Map([
    ...offer.send.map((id) => [id, offer.team] as const),
    ...offer.receive.map((id) => [id, session.userTeamAbbr] as const),
  ]);
  session.picks = session.picks.map((p) =>
    owners.has(p.id) ? { ...p, ownerTeamAbbr: owners.get(p.id)! } : p,
  );
  session.tradeState.futurePicks = session.tradeState.futurePicks.map((p) =>
    owners.has(p.id) ? { ...p, owningTeamAbbr: owners.get(p.id)! } : p,
  );
  offer.status = 'accepted';
  session.tradeState.history.push({
    id: offer.id,
    team: offer.team,
    pick: session.currentPickIndex,
    valuation: evaluateMockPackage(resolved.send, resolved.receive, tradeYear(session)),
    ...resolved,
  });
  expireMockOffers(session);
  return session;
}
// Shared, read-only preview of the same valuation and CPU threshold used at submission.
export function evaluateMockProposal(
  session: DraftSessionDTO,
  team: string,
  send: string[],
  receive: string[],
) {
  const pkg = resolveMockPackage(session, team, send, receive);
  const value = evaluateMockPackage(pkg.send, pkg.receive, tradeYear(session));
  const targetPick = pkg.send.find((p) => p.year === tradeYear(session));
  const ownPick = pkg.receive.find((p) => p.year === tradeYear(session));
  const m = motivation(
    session,
    team,
    targetPick?.overallSlot ?? session.currentPickIndex + 1,
    ownPick?.overallSlot ?? session.currentPickIndex + 1,
  );
  const traits = tradePersonality(session, team);
  const movingUp = (targetPick?.overallSlot ?? Infinity) < (ownPick?.overallSlot ?? Infinity);
  const futureShare =
    pkg.receive
      .filter((p) => p.year > tradeYear(session))
      .reduce((sum, p) => sum + pickValue(p, tradeYear(session)), 0) / Math.max(1, value.received);
  const maxRatio =
    1 +
    (movingUp ? m.score : 0.2) * MOCK_TRADE_CONFIG.acceptanceMotivationBonus -
    traits.valueSensitivity * MOCK_TRADE_CONFIG.acceptanceSensitivityPenalty +
    futureShare * (1 - traits.futurePreference) * 0.03;
  const acceptable = value.ratio >= MOCK_TRADE_CONFIG.proposalMinRatio && value.ratio <= maxRatio;
  const interest =
    value.ratio < MOCK_TRADE_CONFIG.proposalMinRatio
      ? 0
      : value.ratio <= maxRatio * 0.9
        ? 4
        : acceptable
          ? 3
          : value.ratio <= maxRatio * 1.1
            ? 2
            : value.ratio < MOCK_TRADE_CONFIG.proposalMaxRatio
              ? 1
              : 0;
  return {
    pkg,
    value,
    targetPick,
    ownPick,
    m,
    maxRatio,
    acceptable,
    interest,
    interestLabel: ['Very Low', 'Low', 'Moderate', 'High', 'Very High'][interest],
    explanation: acceptable
      ? m.reason
      : 'This package is outside the team’s current acceptance threshold.',
  };
}

export function proposeMockTrade(
  session: DraftSessionDTO,
  team: string,
  send: string[],
  receive: string[],
  counterId?: string,
) {
  expireMockOffers(session);
  const state = session.tradeState!;
  if (!state || session.status !== 'in_progress') throw new Error('No active mock draft.');
  const prior = counterId
    ? state.offers.find((o) => o.id === counterId && o.team === team && o.status === 'active')
    : undefined;
  if (counterId && !prior) throw new Error('This negotiation has expired.');
  const { pkg, value, targetPick, ownPick, m, maxRatio } = evaluateMockProposal(
    session,
    team,
    send,
    receive,
  );
  const exchanges = (prior?.exchanges ?? 0) + 1;
  const offer: MockTradeOffer = {
    id: `proposal-${session.id}-${state.offers.length}`,
    team,
    intent:
      (targetPick?.overallSlot ?? 999) < (ownPick?.overallSlot ?? 999) ? 'move_up' : 'move_down',
    send,
    receive,
    status: 'active',
    reason: m.reason,
    createdPick: session.currentPickIndex,
    exchanges,
  };
  if (value.ratio >= MOCK_TRADE_CONFIG.proposalMinRatio && value.ratio <= maxRatio) {
    if (prior) prior.status = 'countered';
    state.offers.push(offer);
    executeMockTrade(session, offer);
    return {
      outcome: 'accepted',
      reason: 'The package meets the team’s value and roster priorities.',
    };
  }
  if (
    exchanges < MOCK_TRADE_CONFIG.maxExchanges &&
    value.ratio >= MOCK_TRADE_CONFIG.proposalMinRatio &&
    value.ratio < MOCK_TRADE_CONFIG.proposalMaxRatio
  ) {
    const counter = balance(session, pkg.send, pkg.receive, team, Math.min(1, maxRatio));
    if (
      counter &&
      Math.abs(
        evaluateMockPackage(counter.send, counter.receive, tradeYear(session)).ratio -
          Math.min(1, maxRatio),
      ) < MOCK_TRADE_CONFIG.counterTolerance
    ) {
      if (prior) prior.status = 'countered';
      state.offers.push({
        ...offer,
        originalPackage: { send: [...send], receive: [...receive] },
        send: counter.send.map((p) => p.id),
        receive: counter.receive.map((p) => p.id),
        reason: 'The team needs additional value to agree. This is its revised package.',
      });
      return {
        outcome: 'countered',
        reason: 'The team returned a counteroffer. Review it in Incoming Offers.',
      };
    }
  }
  if (prior) prior.status = 'declined';
  state.offers.push({ ...offer, status: 'declined' });
  return {
    outcome: 'declined',
    reason:
      exchanges >= MOCK_TRADE_CONFIG.maxExchanges
        ? 'Final decision: the package does not meet the team’s valuation.'
        : 'The requested value exceeds the team’s willingness to pay.',
  };
}
