export type ScheduledTriviaEvent = {
  id: string;
  teamId: string;
  startsAt: string;
  endsAt: string;
  timezone: string;
  status: 'SCHEDULED' | 'LIVE' | 'COMPLETED';
  registrationCount: number;
  registered: boolean;
};
export function triviaEventLive(event: ScheduledTriviaEvent, now: number) {
  return (
    event.status !== 'COMPLETED' &&
    now < Date.parse(event.endsAt) &&
    (event.status === 'LIVE' || now >= Date.parse(event.startsAt))
  );
}
export function triviaCountdown(startsAt: string, now: number) {
  const seconds = Math.max(0, Math.ceil((Date.parse(startsAt) - now) / 1000));
  return [Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, seconds % 60].map((n) =>
    String(n).padStart(2, '0'),
  );
}
export function triviaEventTime(event: ScheduledTriviaEvent, now: number) {
  const date = new Date(event.startsAt),
    timezone = event.timezone;
  const day = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  });
  const label =
    day.format(date) === day.format(new Date(now))
      ? 'TONIGHT'
      : new Intl.DateTimeFormat('en-US', {
          timeZone: timezone,
          weekday: 'short',
          month: 'short',
          day: 'numeric',
        })
          .format(date)
          .toUpperCase();
  const time = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  })
    .format(date)
    .replace(/\b[ECMP][DS]T\b/g, (s) => s[0] + 'T');
  return `${label} · ${time}`;
}
