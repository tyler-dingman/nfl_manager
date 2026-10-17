import type { HomeMarket } from './research';
import { specificMarket } from './market-navigation';
export type PropGroup = {
  key: string;
  primary: HomeMarket;
  selections: HomeMarket[];
  bestScore: number | null;
};
/** Input is already individually eligible and sorted; the first occurrence ranks each group.
 * A standard selection remains the lead even if an alternate gives the group its ranking. */
export function groupPropSelections(ranked: HomeMarket[]): PropGroup[] {
  const groups = new Map<string, HomeMarket[]>();
  for (const m of ranked) {
    const key = [m.eventId, m.playerId, m.period, specificMarket(m)].join('|');
    const list = groups.get(key) ?? [];
    list.push(m);
    groups.set(key, list);
  }
  return [...groups].map(([key, selections]) => {
    const primary = selections.find((m) => m.lineType === 'main') ?? selections[0];
    const scores = selections
      .map((m) =>
        m.trend?.projection && m.trend.projection.estimatedProbability == null
          ? null
          : m.trend?.trendScore,
      )
      .filter((v): v is number => v != null);
    return {
      key,
      primary,
      selections: [
        primary,
        ...selections
          .filter((m) => m !== primary)
          .sort((a, b) => Number(b.lineType === 'main') - Number(a.lineType === 'main')),
      ],
      bestScore: scores.length ? Math.max(...scores) : null,
    };
  });
}
