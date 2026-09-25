import { gameInfoPattern } from '@/components/beat/beat-semantics';
import { TEAM_LIST } from '@/data/teams';
import { beatTeam } from '@/components/beat/beat-model';
import type { BeatStoryInput } from '@/components/beat/beat-story-adapter';
import type { CanonicalGame } from '@/lib/canonical-game';

export type GameResolution = {
  gameId?: string;
  confidence: 'high' | 'unresolved';
  method: string;
  reason: string;
};
export type GameStory = BeatStoryInput & {
  gameId?: string | null;
  publishedAt?: string;
  gameWeek?: number;
  gameDate?: string;
  opponent?: string;
  season?: number;
  seasonType?: CanonicalGame['seasonType'];
};
const escape = (v: string) => v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
export function gameStoryHints(story: GameStory) {
  const h = story.headline;
  const relevant =
    gameInfoPattern.test(h) ||
    /\bgame\b|matchup|how to watch|watch and stream|preview|know before you go|expert picks|know your foe|scouting report|\bvs\.?\b|\bagainst\b|\bdefeat|\brecap\b|\bwin\b|\bloss\b|\bopener\b|inactive|injury report|week \d/i.test(
      h,
    );
  const own = beatTeam(story.teamAbbr);
  const findTeams = (text: string) =>
    TEAM_LIST.filter(
      (t) =>
        new RegExp(
          '\\b(?:' +
            [
              t.name,
              t.name.split(' ').at(-1)!,
              ...(!['NYG', 'NYJ', 'LAC', 'LAR'].includes(t.abbr)
                ? [t.name.split(' ').slice(0, -1).join(' ')]
                : []),
            ]
              .map(escape)
              .join('|') +
            ')\\b',
          'i',
        ).test(text) || new RegExp('\\b' + escape(t.abbr) + '\\b').test(text),
    )
      .map((t) => t.abbr)
      .filter((t) => t !== own);
  const titleTeams = findTeams(h);
  const opponents = titleTeams.length ? titleTeams : findTeams(story.summary);
  const opponent = story.opponent
    ? beatTeam(story.opponent)
    : opponents.length === 1
      ? opponents[0]
      : undefined;
  const publication = new Date(story.publishedAt ?? story.updatedAt ?? '');
  const year = publication.getUTCFullYear();
  const season =
    story.season ??
    Number(
      h.match(/\b(20\d{2}) (?:NFL )?season\b/i)?.[1] ??
        (publication.getUTCMonth() < 3 ? year - 1 : year),
    );
  const seasonType =
    story.seasonType ??
    (/preseason/i.test(h)
      ? 'PRE'
      : /wild.card|divisional round|conference championship|super bowl|postseason|playoff/i.test(h)
        ? 'POST'
        : 'REG');
  const playoffWeek = /wild.card/i.test(h)
    ? 1
    : /divisional round/i.test(h)
      ? 2
      : /conference championship/i.test(h)
        ? 3
        : /super bowl/i.test(h)
          ? 5
          : undefined;
  return {
    relevant,
    own,
    opponent,
    season,
    seasonType,
    week: story.gameWeek ?? playoffWeek ?? Number(h.match(/\bweek\s+(\d{1,2})\b/i)?.[1] ?? 0),
    date: story.gameDate ?? h.match(/\b20\d{2}-\d{2}-\d{2}\b/)?.[0],
    publication,
  };
}
export function resolveStoryGame(story: GameStory, games: CanonicalGame[]): GameResolution {
  const unresolved = (reason: string): GameResolution => ({
    confidence: 'unresolved',
    method: 'none',
    reason,
  });
  const hint = gameStoryHints(story);
  const accept = (g: CanonicalGame, method: string): GameResolution => ({
    gameId: g.id,
    confidence: 'high',
    method,
    reason: 'Unique canonical schedule match',
  });
  if (story.gameId) {
    const g = games.find((g) => g.id === story.gameId);
    return g && (g.homeTeam === hint.own || g.awayTeam === hint.own)
      ? accept(g, 'explicit-game-id')
      : unresolved('Explicit game does not belong to selected team or is unavailable');
  }
  if (!hint.relevant || !hint.own || !hint.opponent)
    return unresolved('No unambiguous game subject/opponent');
  const candidates = games.filter(
    (g) =>
      g.season === hint.season &&
      g.seasonType === hint.seasonType &&
      ((g.homeTeam === hint.own && g.awayTeam === hint.opponent) ||
        (g.awayTeam === hint.own && g.homeTeam === hint.opponent)),
  );
  if (hint.week) {
    const matched = candidates.filter((g) => g.week === hint.week);
    return matched.length === 1
      ? accept(matched[0], 'team-opponent-week')
      : unresolved('Explicit week conflicts with or does not uniquely identify schedule');
  }
  if (hint.date) {
    const matched = candidates.filter(
      (g) =>
        g.kickoffAt &&
        new Intl.DateTimeFormat('en-CA', {
          timeZone: 'America/New_York',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        }).format(new Date(g.kickoffAt)) === hint.date,
    );
    return matched.length === 1
      ? accept(matched[0], 'team-opponent-date')
      : unresolved('Explicit date does not uniquely match schedule');
  }
  if (!Number.isFinite(hint.publication.getTime()))
    return unresolved('Publication date unavailable');
  const nearest = candidates
    .filter((g) => g.kickoffAt)
    .map((g) => ({
      g,
      d: Math.abs(new Date(g.kickoffAt!).getTime() - hint.publication.getTime()) / 86400000,
    }))
    .sort((a, b) => a.d - b.d);
  if (!nearest.length || nearest[0].d > 10 || (nearest[1] && nearest[1].d - nearest[0].d < 3))
    return unresolved('No sufficiently close, unambiguous scheduled game');
  return accept(nearest[0].g, 'team-opponent-publication');
}
