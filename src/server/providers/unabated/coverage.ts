import type { UnabatedOdds } from './types';
/** Shadow-only flattening. IDs remain Unabated IDs until mappings are verified using live discovery.
 * In particular, marketLineId is never a FanDuel selectionId. */
export function flattenUnabatedProps(board: UnabatedOdds, now = Date.now()) {
  const selections = [];
  for (const league of Object.values(board.odds ?? {})) {
    for (const period of Object.values(league.periodTypes ?? {})) {
      for (const group of Object.values(period.pregame ?? {})) {
        if (
          group.isLive ||
          group.statusId !== 1 ||
          group.eventId == null ||
          !group.eventStart ||
          !(Date.parse(group.eventStart) > now)
        )
          continue;
        for (const side of Object.values(group.sides ?? {})) {
          if (side.personId == null) continue;
          for (const main of Object.values(side.marketSourceLines ?? {})) {
            for (const [index, line] of [main, ...(main.alternateLines ?? [])].entries()) {
              selections.push({
                eventId: group.eventId,
                eventName: group.eventName,
                eventStart: group.eventStart,
                leagueId: league.leagueId,
                periodTypeId: period.periodTypeId,
                betTypeId: group.betTypeId,
                betSubType: group.betSubType,
                personId: side.personId,
                teamId: side.teamId,
                sideIndex: side.sideIndex,
                sideName: side.sideName,
                marketId: line.marketId,
                marketLineId: line.marketLineId,
                marketSourceId: line.marketSourceId,
                points: line.points ?? null,
                price: line.price ?? null,
                lineType: index === 0 ? ('main' as const) : ('alternate' as const),
                available:
                  line.statusId === 1 &&
                  !line.disabled &&
                  line.price != null &&
                  Math.abs(line.price) >= 100 &&
                  (!line.freshnessExpiresAt || Date.parse(line.freshnessExpiresAt) > now),
                // Deliberately never inherit a main-line URL or partner identifiers onto an alternate.
                deepLink: line.deepLink ?? null,
                sportsbookMarketId: line.partnerOddsData?.fanduel?.marketId ?? null,
                sportsbookSelectionId: line.partnerOddsData?.fanduel?.selectionId ?? null,
                modifiedOn: line.modifiedOn ?? null,
                freshnessExpiresAt: line.freshnessExpiresAt ?? null,
              });
            }
          }
        }
      }
    }
  }
  return selections;
}
export type ShadowSelection = ReturnType<typeof flattenUnabatedProps>[number];
export function coverageCounts(rows: ShadowSelection[]) {
  const available = rows.filter((row) => row.available);
  const identities = available.map((r) =>
    [
      r.eventId,
      r.periodTypeId,
      r.betTypeId,
      r.betSubType,
      r.personId,
      r.sideIndex,
      r.marketSourceId,
      r.points,
    ].join('|'),
  );
  return {
    games: new Set(available.map((r) => r.eventId)).size,
    offers: available.length,
    standard: available.filter((r) => r.lineType === 'main').length,
    alternate: available.filter((r) => r.lineType === 'alternate').length,
    withDeepLinks: available.filter((r) => r.deepLink).length,
    withProviderLineIds: available.filter((r) => r.marketLineId != null).length,
    withSportsbookSelectionIds: available.filter((r) => r.sportsbookSelectionId != null).length,
    duplicateOffers: identities.length - new Set(identities).size,
    missingModifiedOn: available.filter((r) => !r.modifiedOn).length,
    oldestModifiedOn:
      available
        .map((r) => r.modifiedOn)
        .filter((d): d is string => !!d)
        .sort()[0] ?? null,
  };
}
