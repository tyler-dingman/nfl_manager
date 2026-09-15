import { TEAM_LIST } from '@/data/teams';
import { NFL_LEAGUE_DATA } from '@/server/data/nfl-data';
import type {
  SportsGameOddsBookLine,
  SportsGameOddsEvent,
} from '@/server/providers/sportsGameOdds';
import { PROVIDER_SPORTSBOOK_IDS, sportsbookIdFromProvider, type Sportsbook } from './sportsbooks';

export type MarketType =
  | 'MONEYLINE'
  | 'SPREAD'
  | 'TOTAL'
  | 'PASSING_YARDS'
  | 'PASSING_RUSHING_YARDS'
  | 'PASSING_TD'
  | 'PASSING_INTERCEPTIONS'
  | 'PASSING_ATTEMPTS'
  | 'PASSING_COMPLETIONS'
  | 'PASSING_LONGEST_COMPLETION'
  | 'RUSHING_YARDS'
  | 'RUSHING_TD'
  | 'RUSHING_ATTEMPTS'
  | 'RUSHING_LONGEST_RUSH'
  | 'RECEIVING_YARDS'
  | 'RECEPTIONS'
  | 'RECEIVING_LONGEST_RECEPTION'
  | 'RUSHING_RECEIVING_YARDS'
  | 'TOUCHDOWNS'
  | 'COMBINED_TACKLES'
  | 'SOLO_TACKLES'
  | 'ASSISTED_TACKLES'
  | 'SACKS'
  | 'KICKING_POINTS'
  | 'EXTRA_POINTS_MADE'
  | 'BOTH_TEAMS_TO_SCORE'
  | 'OTHER';
export type NormalizedOddsMarket = {
  providerMarketId: string;
  marketType: MarketType;
  statId: string;
  entityId: string;
  playerId: string | null;
  teamId: string | null;
  period: string;
  side: string;
  line: number | null;
  normalizedKey: string;
  isAltLine: boolean;
  providerMarketName: string | null;
  normalizationStatus: 'KNOWN' | 'PARTIALLY_MAPPED' | 'UNMAPPED';
  rawProviderMetadata: Record<string, unknown>;
  prices: Array<{
    sportsbook: Sportsbook;
    providerSelectionId: string;
    odds: number | null;
    line: number | null;
    available: boolean;
    deeplink: string | null;
  }>;
};

const token = (value: unknown) =>
  String(value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
const numeric = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};
const valueFrom = (object: unknown, keys: string[]) => {
  if (!object || typeof object !== 'object') return undefined;
  const row = object as Record<string, unknown>;
  for (const key of keys) if (row[key] !== undefined && row[key] !== null) return row[key];
};
export const teamProviderId = (team: unknown) =>
  String(
    typeof team === 'string'
      ? team
      : (valueFrom(team, ['teamID', 'id', 'abbreviation', 'abbr']) ?? ''),
  );

export const resolveTeamAbbr = (providerTeam: unknown) => {
  const raw = teamProviderId(providerTeam);
  const match = (value: unknown) => {
    const target = token(value).replace(/nfl$/, '');
    return (
      TEAM_LIST.find((team) =>
        [team.abbr, team.name, team.city + team.name].some((entry) => token(entry) === target),
      )?.abbr ?? null
    );
  };
  // Provider IDs are stable identifiers. Prefer them over display metadata,
  // which can be stale or internally inconsistent on an event payload.
  return match(raw) ?? match(valueFrom(providerTeam, ['name', 'displayName', 'longName'])) ?? null;
};

export const marketTypeFor = (statID = '', betTypeID = ''): MarketType => {
  const stat = token(statID),
    bet = token(betTypeID);
  if (bet === 'ml') return 'MONEYLINE';
  if (bet === 'sp') return 'SPREAD';
  if (stat === 'points' && bet === 'ou') return 'TOTAL';
  if (stat.includes('passingrushingyard')) return 'PASSING_RUSHING_YARDS';
  if (stat.includes('passingyard')) return 'PASSING_YARDS';
  if (stat.includes('passingtouchdown')) return 'PASSING_TD';
  if (stat.includes('passinginterception')) return 'PASSING_INTERCEPTIONS';
  if (stat.includes('passingattempt')) return 'PASSING_ATTEMPTS';
  if (stat.includes('passinglongestcompletion')) return 'PASSING_LONGEST_COMPLETION';
  if (stat.includes('passingcompletion')) return 'PASSING_COMPLETIONS';
  if (stat.includes('rushingreceivingyard')) return 'RUSHING_RECEIVING_YARDS';
  if (stat.includes('rushingyard')) return 'RUSHING_YARDS';
  if (stat.includes('rushingtouchdown')) return 'RUSHING_TD';
  if (stat.includes('rushingattempt')) return 'RUSHING_ATTEMPTS';
  if (stat.includes('rushinglongestrush')) return 'RUSHING_LONGEST_RUSH';
  if (stat.includes('receivingyard')) return 'RECEIVING_YARDS';
  if (stat.includes('receivinglongestreception')) return 'RECEIVING_LONGEST_RECEPTION';
  if (stat.includes('reception')) return 'RECEPTIONS';
  if (stat.includes('combinedtackle')) return 'COMBINED_TACKLES';
  if (stat.includes('solotackle')) return 'SOLO_TACKLES';
  if (stat.includes('assistedtackle')) return 'ASSISTED_TACKLES';
  if (stat.includes('defensesack')) return 'SACKS';
  if (stat.includes('kickingtotalpoint')) return 'KICKING_POINTS';
  if (stat.includes('extrapointskicksmade')) return 'EXTRA_POINTS_MADE';
  if (stat.includes('bothteamsscored')) return 'BOTH_TEAMS_TO_SCORE';
  if (stat.includes('touchdown')) return 'TOUCHDOWNS';
  return 'OTHER';
};

export function resolvePlayer(event: SportsGameOddsEvent, providerPlayerId: string) {
  const raw = event.players?.[providerPlayerId];
  const names = valueFrom(raw, ['names']);
  const name = String(
    valueFrom(raw, ['name', 'displayName']) ??
      valueFrom(names, ['display']) ??
      providerPlayerId.replace(/_\d*_NFL$/i, '').replaceAll('_', ' '),
  );
  const team = resolveTeamAbbr(valueFrom(raw, ['teamID', 'teamId', 'team']));
  const position = token(valueFrom(raw, ['position', 'positionID']));
  const matches = NFL_LEAGUE_DATA.players.filter((player) => token(player.name) === token(name));
  return (
    matches.find(
      (player) =>
        (!team || player.teamAbbr === team) && (!position || token(player.position) === position),
    ) ??
    matches[0] ??
    null
  );
}

const lineFor = (betType: string | undefined, row: SportsGameOddsBookLine) =>
  numeric(token(betType) === 'sp' ? row.spread : (row.overUnder ?? row.spread));

export function normalizeEventMarkets(event: SportsGameOddsEvent) {
  const grouped = new Map<string, NormalizedOddsMarket>();
  const unmapped = new Set<string>();
  for (const [oddKey, odd] of Object.entries(event.odds ?? {})) {
    const marketType = marketTypeFor(odd.statID, odd.betTypeID);
    const entity = odd.statEntityID ?? '';
    const isPlayer = Boolean(entity) && !['home', 'away', 'all'].includes(entity.toLowerCase());
    const player = isPlayer ? resolvePlayer(event, entity) : null;
    if (isPlayer && !player) unmapped.add(entity);
    const team =
      entity.toLowerCase() === 'home'
        ? resolveTeamAbbr(event.teams?.home)
        : entity.toLowerCase() === 'away'
          ? resolveTeamAbbr(event.teams?.away)
          : null;
    for (const bookmaker of PROVIDER_SPORTSBOOK_IDS) {
      const main = odd.byBookmaker?.[bookmaker];
      if (!main) continue;
      const rows = [main, ...(Array.isArray(main.altLines) ? main.altLines : [])];
      rows.forEach((row, index) => {
        const line = lineFor(odd.betTypeID, row);
        const side = (odd.sideID ?? '').toUpperCase();
        const period = odd.periodID ?? 'game';
        const identity = player?.id ?? team ?? (entity.toLowerCase() || 'all');
        const normalizedKey = [
          marketType.toLowerCase(),
          period.toLowerCase(),
          identity.toLowerCase(),
          side.toLowerCase(),
          line ?? 'none',
        ].join(':');
        const market = grouped.get(normalizedKey) ?? {
          providerMarketId: odd.oddID ?? oddKey,
          marketType,
          statId: odd.statID ?? '',
          entityId: entity,
          playerId: player?.id ?? null,
          teamId: team,
          period,
          side,
          line,
          normalizedKey,
          isAltLine: index > 0,
          providerMarketName: odd.marketName ?? null,
          normalizationStatus:
            marketType !== 'OTHER'
              ? ('KNOWN' as const)
              : player || team
                ? ('PARTIALLY_MAPPED' as const)
                : ('UNMAPPED' as const),
          rawProviderMetadata: { oddKey, odd, selectedBookLine: row },
          prices: [],
        };
        const price = {
          sportsbook: sportsbookIdFromProvider(bookmaker),
          providerSelectionId: String(
            row.oddID ??
              String(odd.oddID ?? oddKey) + ':' + bookmaker + ':' + String(line ?? 'main'),
          ),
          odds: numeric(row.odds),
          line,
          available: row.available !== false,
          deeplink: typeof row.deeplink === 'string' ? row.deeplink : null,
        };
        const existingPrice = market.prices.findIndex(
          (candidate) => candidate.sportsbook === price.sportsbook,
        );
        if (existingPrice === -1) market.prices.push(price);
        else if (!market.prices[existingPrice].deeplink && price.deeplink)
          market.prices[existingPrice] = price;
        // A provider can repeat the same threshold both as a main line and
        // inside another record's alternate ladder. If any representation is
        // canonical (index 0), the grouped market is canonical as well.
        market.isAltLine &&= index > 0;
        grouped.set(normalizedKey, market);
      });
    }
  }
  return { markets: [...grouped.values()], unmappedPlayers: [...unmapped] };
}

export const altLineLabel = (name: string, line: number, marketType: MarketType) =>
  name +
  ' ' +
  Math.ceil(line) +
  '+ ' +
  (marketType === 'PASSING_YARDS'
    ? 'Passing Yards'
    : marketType === 'RUSHING_YARDS'
      ? 'Rushing Yards'
      : marketType.replaceAll('_', ' '));
