export type Play = {
  visualization?: import('./play-visualization').PlayVisualization;
  id: string;
  sequence: number;
  quarter: number;
  clock: string;
  down: string;
  location: string;
  text: string;
  yards: number | null;
  resultType?: string;
  scoring: boolean;
  key: boolean;
  driveId: string;
  at: string | null;
};
export type Game = {
  id: string;
  home: string;
  away: string;
  homeRecord?: string;
  awayRecord?: string;
  homeScore: number | null;
  awayScore: number | null;
  status: 'pregame' | 'live' | 'halftime' | 'final';
  clock: string;
  quarter: number;
  kickoff: string;
  possession: string | null;
  down: string;
  location: string;
  ball: number | null;
  direction: 1 | -1;
  firstDownTarget?: number | null;
  driveId: string | null;
  driveSummary: string | null;
  updatedAt: string;
  plays: Play[];
};
export type Message = {
  media?: import('../gifs').GifReference;
  /** Resolved media is transient client state, never a database payload. */
  resolvedGif?: import('../gifs').GifItem;
  replyTo?: string;
  kind?: 'comment' | 'update' | 'poll';
  pollId?: string;
  id: string;
  userId: string;
  name: string;
  avatar: string | null;
  body: string;
  at: string;
  playId: string | null;
  likes: number;
  removed: boolean;
};
export type Poll = {
  id: string;
  question: string;
  options: string[];
  counts: number[];
  closed: boolean;
};
export type Snapshot = {
  daily?: import('./daily').DailyHuddle;
  historyPage?: boolean;
  messages: Message[];
  polls: Poll[];
  game: Game | null;
  participants: number | null;
  cursor: string;
  before: string | null;
  hiddenUsers: string[];
  voted: Record<string, number>;
  liked: string[];
  canModerate: boolean;
  unavailable?: string;
  gameError?: string;
};
export type PlayFilter = 'All Plays' | 'Current Drive' | 'Scoring' | 'Key Plays';
export function filterPlays(game: Game | null, filter: PlayFilter) {
  return (game?.plays ?? [])
    .filter(
      (p) =>
        filter === 'All Plays' ||
        (filter === 'Current Drive'
          ? !!game?.driveId && p.driveId === game.driveId
          : filter === 'Scoring'
            ? p.scoring
            : p.key),
    )
    .sort((a, b) => b.sequence - a.sequence);
}
export function mergeMessages(current: Message[], incoming: Message[], limit = 250, older = false) {
  const byId = new Map(current.map((m) => [m.id, m]));
  incoming.forEach((m) => byId.set(m.id, m));
  return [...byId.values()]
    .sort((a, b) => a.at.localeCompare(b.at) || a.id.localeCompare(b.id))
    .slice(older ? 0 : -limit, older ? limit : undefined);
}
export function huddleHref(
  team: string,
  context: { game?: string; discussion?: string; play?: string } = {},
) {
  const q = new URLSearchParams({
    team,
    ...Object.fromEntries(Object.entries(context).filter(([, v]) => v)),
  });
  return `/huddle?${q}`;
}
export function relativeTime(at: string) {
  const seconds = Math.max(0, Math.floor((Date.now() - Date.parse(at)) / 1000));
  return seconds < 60
    ? `${seconds}s ago`
    : seconds < 3600
      ? `${Math.floor(seconds / 60)}m ago`
      : `${Math.floor(seconds / 3600)}h ago`;
}
