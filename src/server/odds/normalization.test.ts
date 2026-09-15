import assert from 'node:assert/strict';
import test from 'node:test';
import {
  altLineLabel,
  marketTypeFor,
  normalizeEventMarkets,
  resolveTeamAbbr,
} from './normalization';
import type { SportsGameOddsEvent } from '@/server/providers/sportsGameOdds';

const fixture = (overrides: Partial<SportsGameOddsEvent> = {}): SportsGameOddsEvent => ({
  eventID: 'den-kc',
  teams: { home: { teamID: 'KC' }, away: { teamID: 'DEN' } },
  players: { PATRICK_MAHOMES_1_NFL: { name: 'Patrick Mahomes', teamID: 'KC', position: 'QB' } },
  odds: {
    'passingYards-PATRICK_MAHOMES_1_NFL-game-ou-over': {
      oddID: 'passingYards-PATRICK_MAHOMES_1_NFL-game-ou-over',
      statID: 'passingYards',
      statEntityID: 'PATRICK_MAHOMES_1_NFL',
      periodID: 'game',
      betTypeID: 'ou',
      sideID: 'over',
      byBookmaker: {
        draftkings: {
          odds: -115,
          overUnder: 259.5,
          available: true,
          deeplink: 'https://example.com/dk',
          altLines: [{ odds: -130, overUnder: 249.5, available: true }],
        },
        fanduel: { odds: -110, overUnder: 259.5, available: true },
        betmgm: { odds: -112, overUnder: 259.5, available: true },
        caesars: { odds: -108, overUnder: 259.5, available: true },
      },
    },
  },
  ...overrides,
});

test('alternate lines remain distinct and use the display threshold without changing provider line', () => {
  const result = normalizeEventMarkets(fixture());
  const alt = result.markets.find((market) => market.line === 249.5);
  assert.equal(alt?.line, 249.5);
  assert.equal(alt?.isAltLine, true);
  assert.equal(
    altLineLabel('Patrick Mahomes', 249.5, 'PASSING_YARDS'),
    'Patrick Mahomes 250+ Passing Yards',
  );
});

test('a missing FanDuel line does not remove DraftKings', () => {
  const event = fixture();
  delete event.odds!['passingYards-PATRICK_MAHOMES_1_NFL-game-ou-over'].byBookmaker!.fanduel;
  const prices = normalizeEventMarkets(event).markets.flatMap((market) => market.prices);
  assert.equal(
    prices.some((price) => price.sportsbook === 'DRAFTKINGS'),
    true,
  );
  assert.equal(
    prices.some((price) => price.sportsbook === 'FANDUEL'),
    false,
  );
});

test('missing deeplinks remain null and player mapping failures are reported', () => {
  const event = fixture({ players: {} });
  const odd = event.odds!['passingYards-PATRICK_MAHOMES_1_NFL-game-ou-over'];
  odd.statEntityID = 'UNKNOWN_PLAYER_1_NFL';
  const result = normalizeEventMarkets(event);
  assert.equal(
    result.markets.some((market) => market.prices.some((price) => price.deeplink === null)),
    true,
  );
  assert.deepEqual(result.unmappedPlayers, ['UNKNOWN_PLAYER_1_NFL']);
});

test('duplicate provider odds collapse into one canonical market per period and line', () => {
  const event = fixture();
  const original = event.odds!['passingYards-PATRICK_MAHOMES_1_NFL-game-ou-over'];
  event.odds!['provider-duplicate-id'] = {
    ...original,
    oddID: 'provider-duplicate-id',
    byBookmaker: {
      fanduel: {
        odds: -110,
        overUnder: 259.5,
        available: true,
        deeplink: 'https://example.com/fd',
      },
    },
  };

  const result = normalizeEventMarkets(event);
  const mainLines = result.markets.filter((market) => market.line === 259.5);
  assert.equal(mainLines.length, 1);
  assert.deepEqual(mainLines[0].prices.map((price) => price.sportsbook).sort(), [
    'BETMGM',
    'CAESARS',
    'DRAFTKINGS',
    'FANDUEL',
  ]);
  assert.equal(
    mainLines[0].prices.find((price) => price.sportsbook === 'FANDUEL')?.deeplink,
    'https://example.com/fd',
  );
  assert.equal(mainLines[0].isAltLine, false);
});

test('provider stat identifiers map to readable supported market types', () => {
  assert.equal(marketTypeFor('passing_interceptions'), 'PASSING_INTERCEPTIONS');
  assert.equal(marketTypeFor('passing_longestCompletion'), 'PASSING_LONGEST_COMPLETION');
  assert.equal(marketTypeFor('defense_combinedTackles'), 'COMBINED_TACKLES');
  assert.equal(marketTypeFor('rushing+receiving_yards'), 'RUSHING_RECEIVING_YARDS');
  assert.equal(marketTypeFor('passing+rushing_yards'), 'PASSING_RUSHING_YARDS');
  assert.equal(marketTypeFor('receiving_longestReception'), 'RECEIVING_LONGEST_RECEPTION');
  assert.equal(marketTypeFor('kicking_totalPoints'), 'KICKING_POINTS');
  assert.equal(marketTypeFor('extraPoints_kicksMade'), 'EXTRA_POINTS_MADE');
});

test('stable provider team id wins over conflicting display metadata', () => {
  assert.equal(resolveTeamAbbr({ teamID: 'KANSAS_CITY_CHIEFS_NFL', name: 'Chicago Bears' }), 'KC');
});

test('unrecognized NFL markets are preserved with raw provider metadata', () => {
  const event = fixture({
    odds: {
      custom: {
        oddID: 'custom-market',
        marketName: 'Quarterback First Drive Result',
        statID: 'quarterback_first_drive_result',
        statEntityID: 'PATRICK_MAHOMES_1_NFL',
        periodID: '1q',
        sideID: 'yes',
        betTypeID: 'yn',
        byBookmaker: {
          fanduel: { odds: 125, available: true },
        },
      },
    },
  });
  const market = normalizeEventMarkets(event).markets[0];
  assert.equal(market.marketType, 'OTHER');
  assert.equal(market.normalizationStatus, 'PARTIALLY_MAPPED');
  assert.equal(market.providerMarketName, 'Quarterback First Drive Result');
  assert.equal(market.rawProviderMetadata.oddKey, 'custom');
});
