type Market = { marketType: string; side: string; line: number | null; period?: string };
export function isAnytimeTD(m: Market) {
  return (
    m.marketType === 'TOUCHDOWNS' &&
    (m.period ?? 'game') === 'game' &&
    m.line == null &&
    ['YES', 'NO'].includes(m.side)
  );
}
/** Statistical equivalent only; never changes the stored sportsbook selection. */
export const researchSide = (side: string) =>
  side === 'YES' ? 'OVER' : side === 'NO' ? 'UNDER' : side;
export const researchThreshold = (m: Market) => (isAnytimeTD(m) ? 0.5 : m.line);
export const propPick = (m: Market) =>
  isAnytimeTD(m)
    ? m.side === 'YES'
      ? 'Yes'
      : 'No'
    : `${m.side === 'OVER' ? 'O' : m.side === 'UNDER' ? 'U' : m.side} ${m.line ?? ''}`.trim();
