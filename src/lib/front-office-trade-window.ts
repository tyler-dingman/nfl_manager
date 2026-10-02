export const TRADE_DEADLINE_MESSAGE =
  'It is past the trade deadline.';

/** Phase owns the clock; offseason may retain the previous season's currentWeek. */
export function isTradeDeadlinePassed(phase?: string | null, currentWeek?: number): boolean {
  if (phase && ['wild-card', 'divisional', 'conference', 'super-bowl', 'playoffs'].includes(phase))
    return true;
  if (phase?.startsWith('week-')) return Number(phase.slice(5)) >= 10;
  if (phase && !['season', 'regular-season'].includes(phase)) return false;
  return (currentWeek ?? 1) >= 10;
}
