export type HomepageGame = {
  id: string;
  weekNumber: number;
  startsAt: string;
  timeZone: string;
  teamAbbr: string;
  teamName: string;
  opponentAbbr: string;
  opponentName: string;
  venue: string | null;
  weather: { temperature: number; condition: string } | null;
  betting: { spread: string | null; overUnder: number | null } | null;
  state: 'PREGAME' | 'LIVE' | 'FINAL';
  devOverride?: boolean;
};

const dateKey = (value: Date, timeZone: string) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(value);

const localMinute = (value: Date, timeZone: string) => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(value);
  const part = (type: string) => Number(parts.find((item) => item.type === type)?.value ?? 0);
  return part('hour') * 60 + part('minute');
};

export function isGameDayActive(startsAt: string, now: Date, timeZone: string) {
  return (
    dateKey(new Date(startsAt), timeZone) === dateKey(now, timeZone) &&
    localMinute(now, timeZone) >= 1
  );
}
