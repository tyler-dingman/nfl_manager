import type { SlipLeg } from './slip';
import { slipOdds } from './slip';
import { transferMarkets } from './transfer-markets';
export const sportsbooks = ['betmgm', 'caesars', 'draftkings', 'fanduel'] as const;
export type Sportsbook = (typeof sportsbooks)[number];
// Application-tested market scope, not a promise of provider coverage.
const transferRules = {
  // Bet type 64 exists, but book-specific combined-yards generation is unverified.
  markets: Object.keys(transferMarkets).filter((market) => market !== 'PASSING_RUSHING_YARDS'),
  regions: 'unresolved; reject region-specific selections',
  sameGame: false,
  validation: 'exact complete slip; omitted direction remains unverified',
  hosts: ['gambly.com', 'www.gambly.com'],
  path: /^\/deeplink\/deeplink-cache-[A-Za-z0-9-]+$/,
} as const;
// Names/cache paths were observed in reports/unabated-three-leg-audit/pilot-results.json.
// Numeric Unabated source IDs are unnecessary for text generation and are not guessed.
export const sportsbookConfig = {
  betmgm: {
    ...transferRules,
    name: 'BetMGM',
    stored: 'BETMGM',
    providerId: 'betmgm',
    unabatedName: 'BetMGM',
    flag: 'ENABLE_BETMGM_BETSLIP',
    capability: 'unverified complete slip; prior response was partial',
  },
  caesars: {
    ...transferRules,
    name: 'Caesars',
    stored: 'CAESARS',
    providerId: 'caesars',
    unabatedName: 'Caesars',
    flag: 'ENABLE_CAESARS_BETSLIP',
    capability: 'unverified complete slip; prior response changed a threshold',
  },
  draftkings: {
    ...transferRules,
    sameGame: true,
    name: 'DraftKings',
    stored: 'DRAFTKINGS',
    providerId: 'draftkings',
    unabatedName: 'DraftKings',
    flag: 'ENABLE_DRAFTKINGS_BETSLIP',
    capability: 'controlled test only; manual verification pending',
  },
  fanduel: {
    ...transferRules,
    sameGame: true,
    name: 'FanDuel',
    stored: 'FANDUEL',
    providerId: 'fanduel',
    unabatedName: 'FanDuel',
    flag: 'ENABLE_FANDUEL_BETSLIP',
    capability: 'controlled test; prior three-leg slip manually verified',
  },
} as const;
export function isSportsbook(value: unknown): value is Sportsbook {
  return typeof value === 'string' && sportsbooks.some((book) => book === value);
}
export type MatchLeg = SlipLeg & {
  kickoffAt?: string;
  oddsUpdatedAt?: string;
  lineType?: 'main' | 'alternate' | 'unknown';
};
export type TransferMatch = { original: MatchLeg; selection: MatchLeg; adjusted: boolean };
export type TransferProposal = {
  sportsbook: Sportsbook;
  matches: TransferMatch[];
  estimatedOdds: number | null;
  adjustments: number;
  token: string;
  expiresAt: string;
};
export type SubstitutionPolicy = { differences: Record<string, number>; minOdds: number };
export const defaultSubstitutionPolicy: SubstitutionPolicy = {
  differences: { PASSING_YARDS: 10, RUSHING_YARDS: 7.5, RECEIVING_YARDS: 7.5, RECEPTIONS: 1 },
  minOdds: -800,
};
export function sameProp(a: MatchLeg, b: MatchLeg) {
  return (
    !!a.playerId &&
    a.playerId === b.playerId &&
    !!a.eventId &&
    a.eventId === b.eventId &&
    a.marketType === b.marketType &&
    a.side === b.side &&
    (a.period ?? 'game') === (b.period ?? 'game')
  );
}
export function matchSportsbook(
  originals: MatchLeg[],
  offers: MatchLeg[],
  book: Sportsbook,
  policy = defaultSubstitutionPolicy,
  now = Date.now(),
) {
  if (
    !originals.length ||
    originals.length > 20 ||
    new Set(originals.map((l) => l.id)).size !== originals.length ||
    (!sportsbookConfig[book].sameGame &&
      new Set(originals.map((l) => l.eventId)).size !== originals.length)
  )
    return null;
  const matches: TransferMatch[] = [];
  for (const original of originals) {
    if (
      !original.playerName ||
      !original.playerId ||
      !original.eventId ||
      !['OVER', 'UNDER'].includes(original.side) ||
      (original.period ?? 'game') !== 'game' ||
      original.line == null ||
      !Number.isFinite(original.line) ||
      !sportsbookConfig[book].markets.includes(original.marketType) ||
      !original.kickoffAt ||
      !(Date.parse(original.kickoffAt) > now)
    )
      return null;
    const maximum = policy.differences[original.marketType];
    const candidates = offers.filter(
      (l) =>
        sameProp(original, l) &&
        !!l.playerName &&
        l.sportsbook === sportsbookConfig[book].stored &&
        l.available &&
        l.line != null &&
        Number.isFinite(l.line) &&
        l.odds != null &&
        Number.isFinite(l.odds) &&
        Math.abs(l.odds) >= 100 &&
        l.kickoffAt === original.kickoffAt &&
        (l.line === original.line ||
          (Number.isFinite(maximum) &&
            maximum >= 0 &&
            Math.abs(l.line - original.line!) <= maximum &&
            l.odds >= policy.minOdds &&
            (l.lineType === 'main' || l.lineType === 'alternate'))),
    );
    const favorable = (l: MatchLeg) =>
      original.side === 'OVER' ? l.line! <= original.line! : l.line! >= original.line!;
    candidates.sort(
      (a, b) =>
        Math.abs(a.line! - original.line!) - Math.abs(b.line! - original.line!) ||
        Number(favorable(b)) - Number(favorable(a)) ||
        (b.trend?.trendScore ?? -1) - (a.trend?.trendScore ?? -1) ||
        (Date.parse(b.oddsUpdatedAt ?? '') || 0) - (Date.parse(a.oddsUpdatedAt ?? '') || 0) ||
        a.id.localeCompare(b.id),
    );
    const selection = candidates[0];
    if (!selection) return null;
    matches.push({ original, selection, adjusted: selection.line !== original.line });
  }
  return {
    sportsbook: book,
    matches,
    estimatedOdds:
      new Set(originals.map((l) => l.eventId)).size < originals.length
        ? null
        : slipOdds(matches.map((m) => m.selection)),
    adjustments: matches.filter((m) => m.adjusted).length,
  };
}
export const sportsbookNotice =
  'Selections may be added to your existing sportsbook bet slip. Review all legs and final odds before continuing.';

export type SportsbookCompatibility = {
  sportsbook: Sportsbook;
  enabled: boolean;
  supported: boolean;
  eligible: boolean;
  matchType: 'exact' | 'adjusted' | 'unavailable';
  exactLegs: number;
  adjustedLegs: number;
  unavailableLegs: number;
  storedExactLegs: number;
  reason?: string;
};
export function resolveSportsbookCompatibility(
  originals: MatchLeg[],
  offers: MatchLeg[],
  book: Sportsbook,
  enabled: boolean,
  policy = defaultSubstitutionPolicy,
  now = Date.now(),
  expectedLegs = originals.length,
) {
  const supported =
    originals.length === expectedLegs &&
    originals.length > 0 &&
    originals.every((l) => sportsbookConfig[book].markets.includes(l.marketType));
  const perLeg = originals.map((l) => matchSportsbook([l], offers, book, policy, now));
  const exactLegs = perLeg.filter((p) => p && !p.adjustments).length;
  const adjustedLegs = perLeg.filter((p) => p && p.adjustments).length;
  const storedExactLegs = originals.filter((o) =>
    offers.some(
      (l) =>
        sameProp(o, l) &&
        l.line === o.line &&
        l.sportsbook === sportsbookConfig[book].stored &&
        l.available &&
        l.odds != null &&
        Number.isFinite(l.odds) &&
        Math.abs(l.odds) >= 100 &&
        l.kickoffAt === o.kickoffAt &&
        Date.parse(l.kickoffAt ?? '') > now,
    ),
  ).length;
  const complete =
    originals.length === expectedLegs
      ? matchSportsbook(originals, offers, book, policy, now)
      : null;
  const eligible = enabled && !!complete;
  const compatibility: SportsbookCompatibility = {
    sportsbook: book,
    enabled,
    supported,
    eligible,
    matchType: complete ? (complete.adjustments ? 'adjusted' : 'exact') : 'unavailable',
    exactLegs,
    adjustedLegs,
    unavailableLegs: expectedLegs - exactLegs - adjustedLegs,
    storedExactLegs,
    ...(!eligible
      ? {
          reason: !enabled
            ? 'Integration disabled.'
            : !supported
              ? 'Transfer support for this market or player identity is not verified.'
              : !sportsbookConfig[book].sameGame &&
                  new Set(originals.map((l) => l.eventId)).size !== originals.length
                ? 'Same-game transfers are not supported yet. Select one prop per NFL game.'
                : 'Stored prices do not support a complete eligible slip.',
        }
      : {}),
  };
  return { compatibility, proposal: eligible ? complete : null };
}
