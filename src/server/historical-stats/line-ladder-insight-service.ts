type LadderRow = {
  displayThreshold: string;
  hitRate: number | null;
  isCurrentLine: boolean;
  fanduelPrice: number | null;
  draftkingsPrice: number | null;
};
const bestPrice = (row: LadderRow) =>
  Math.max(row.fanduelPrice ?? -10000, row.draftkingsPrice ?? -10000);
export function buildLineLadderInsight(rows: LadderRow[], playerName: string) {
  const currentIndex = rows.findIndex((row) => row.isCurrentLine),
    current = rows[currentIndex];
  if (!current || current.hitRate === null) return null;
  const higher = rows.slice(currentIndex + 1).find((row) => row.hitRate !== null);
  if (
    higher &&
    higher.hitRate !== null &&
    current.hitRate - higher.hitRate <= 10 &&
    bestPrice(higher) - bestPrice(current) >= 50
  )
    return `${playerName} has reached ${higher.displayThreshold} nearly as often as ${current.displayThreshold} over the last 10 games, with a materially higher listed price.`;
  const lower = [...rows.slice(0, currentIndex)].reverse().find((row) => row.hitRate !== null);
  if (lower && lower.hitRate !== null && lower.hitRate - current.hitRate >= 20)
    return `Stepping down to ${lower.displayThreshold} improved the historical hit rate by ${lower.hitRate - current.hitRate} percentage points over the last 10 games.`;
  if (higher && higher.hitRate !== null && current.hitRate - higher.hitRate >= 25)
    return `The historical hit rate drops ${current.hitRate - higher.hitRate} percentage points at ${higher.displayThreshold}.`;
  return null;
}
