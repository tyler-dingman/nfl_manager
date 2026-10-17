/** Explicit statistical meanings; unknown markets are never guessed from display text. */
export const transferMarkets: Record<string, string> = {
  PASSING_YARDS: 'Passing Yards',
  PASSING_RUSHING_YARDS: 'Passing + Rushing Yards',
  PASSING_TD: 'Passing Touchdowns',
  PASSING_INTERCEPTIONS: 'Passing Interceptions',
  PASSING_ATTEMPTS: 'Passing Attempts',
  PASSING_COMPLETIONS: 'Passing Completions',
  PASSING_LONGEST_COMPLETION: 'Longest Completion',
  RUSHING_YARDS: 'Rushing Yards',
  RUSHING_TD: 'Rushing Touchdowns',
  RUSHING_ATTEMPTS: 'Rushing Attempts',
  RUSHING_LONGEST_RUSH: 'Longest Rush',
  RECEIVING_YARDS: 'Receiving Yards',
  RECEPTIONS: 'Receptions',
  RECEIVING_LONGEST_RECEPTION: 'Longest Reception',
  RUSHING_RECEIVING_YARDS: 'Rushing + Receiving Yards',
  TOUCHDOWNS: 'Touchdowns',
  COMBINED_TACKLES: 'Tackles + Assists',
  SOLO_TACKLES: 'Solo Tackles',
  ASSISTED_TACKLES: 'Assisted Tackles',
  SACKS: 'Sacks',
  KICKING_POINTS: 'Kicking Points',
  EXTRA_POINTS_MADE: 'Extra Points Made',
};
const aliases: Record<string, string[]> = {
  PASSING_RUSHING_YARDS: ['Passing and Rushing Yards', 'Passing / Rushing Yards'],
  RUSHING_RECEIVING_YARDS: ['Rushing and Receiving Yards', 'Rushing / Receiving Yards'],
  PASSING_TD: ['Passing TDs'],
  RUSHING_TD: ['Rushing TDs'],
  PASSING_INTERCEPTIONS: ['Interceptions Thrown'],
  PASSING_LONGEST_COMPLETION: ['Longest Passing Completion'],
  RUSHING_LONGEST_RUSH: ['Longest Rushing Attempt'],
  RECEIVING_LONGEST_RECEPTION: ['Longest Receiving Reception'],
  COMBINED_TACKLES: ['Combined Tackles', 'Tackles and Assists'],
};
export function matchesTransferMarket(type: string, label: string | null | undefined) {
  const normalized = label?.trim().replace(/\s+/g, ' ').toLowerCase();
  return (
    !!normalized &&
    [transferMarkets[type], ...(aliases[type] ?? [])].some(
      (value) => value?.toLowerCase() === normalized,
    )
  );
}
