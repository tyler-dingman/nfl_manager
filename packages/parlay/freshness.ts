export const ODDS_REFRESH_CRON = '0 15 * * 1,3,6';
export function latestScheduledRefresh(now = new Date()) {
  if (!Number.isFinite(now.getTime())) throw Error('Invalid odds clock');
  const date = new Date(now);
  date.setUTCHours(15, 0, 0, 0);
  if (date > now) date.setUTCDate(date.getUTCDate() - 1);
  while (![1, 3, 6].includes(date.getUTCDay())) date.setUTCDate(date.getUTCDate() - 1);
  return date;
}
export function oddsFreshness(
  completedAt: string | number | null,
  coverage = 'UNKNOWN',
  now = new Date(),
) {
  const timestamp = completedAt === null ? NaN : new Date(completedAt).getTime();
  if (!Number.isFinite(timestamp) || timestamp > now.getTime())
    return {
      state: 'UNVERIFIED',
      text: 'Odds freshness unverified. Refresh target: Mon, Wed and Sat at 15:00 UTC. Confirm current prices with your sportsbook.',
    };
  const stale = timestamp < latestScheduledRefresh(now).getTime();
  return {
    state: stale ? 'STALE' : coverage === 'PARTIAL' ? 'PARTIAL' : 'SCHEDULED',
    text: `Odds as of ${new Date(timestamp).toISOString().replace('T', ' ').slice(0, 16)} UTC. ${stale ? 'Scheduled refresh overdue. ' : ''}${coverage === 'PARTIAL' ? 'Partial sportsbook coverage. ' : coverage==='UNKNOWN'?'Sportsbook coverage unverified. ':''}Refresh target: three times weekly. Confirm current prices with your sportsbook.`,
  };
}
