import type { CanonicalGame } from '../../src/lib/canonical-game';
export function nextGameDate(game: CanonicalGame) {
  if (!game.kickoffAt || !game.kickoffConfirmed) return 'DATE / TIME TO BE ANNOUNCED';
  const date = new Date(game.kickoffAt);
  const day = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
    .format(date)
    .toUpperCase();
  const time = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
  return `${day} · ${time} ET`;
}
