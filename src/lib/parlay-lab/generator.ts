import { TEAM_LIST } from '@/data/teams';
import { parseResearchPrompt, type ResearchCandidate } from './research';
import { americanToDecimal, estimateParlayOdds } from '@/components/parlay-lab/parlay-odds';
export type GeneratorCandidate = ResearchCandidate & {
  playerId?: string | null;
  available: boolean;
  period: string;
  normalizedKey?: string;
  lineType?: string;
};
export type GeneratorGame = {
  id: string;
  homeTeamId: string;
  awayTeamId: string;
  kickoffAt: string;
  marketsLocked?: boolean;
};
export type GeneratorRules = {
  legs: number;
  minScore: number;
  targetOdds: number | null;
  teams: string[];
  players: string[];
  positions: string[];
  excludePositions: string[];
  excludePlayers?: string[];
  requiredPosition?: string;
  markets: string[];
  noTD: boolean;
  tdOnly: boolean;
  sameGame: boolean;
  differentGames: boolean;
  side?: string;
  conservative: boolean;
  upside: boolean;
  today: boolean;
  differentPlayers: boolean;
  issues: string[];
};
const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
const contains = (text: string, phrase: string) => ` ${text} `.includes(` ${norm(phrase)} `);
export function parseGeneratorRequest(
  prompt: string,
  candidates: GeneratorCandidate[],
  favorite?: string,
  previous?: GeneratorRules,
): GeneratorRules {
  const text = norm(prompt),
    base = parseResearchPrompt(prompt);
  const rules: GeneratorRules = previous
    ? { ...previous, issues: [] }
    : {
        legs: 3,
        minScore: 0,
        targetOdds: null,
        teams: [],
        players: [],
        positions: [],
        excludePositions: [],
        markets: [],
        noTD: false,
        tdOnly: false,
        sameGame: false,
        differentGames: false,
        conservative: false,
        upside: false,
        today: false,
        differentPlayers: true,
        issues: [],
      };
  const count = prompt.match(/\b(\d+)\s*[- ]?legs?\b/i);
  if (count) rules.legs = Number(count[1]);
  if (rules.legs < 1 || rules.legs > 8) rules.issues.push('Choose between 1 and 8 legs.');
  const minimum =
    prompt.match(/\b(\d{1,3})\s*\+?\s*(?:lab\s*)?scores?\b/i) ??
    prompt.match(
      /(?:lab\s*)?scores?\s*(?:of\s*)?(?:at least|>=|≥|above|over|minimum)?\s*(\d{1,3})/i,
    );
  if (minimum) rules.minScore = Number(minimum[1]);
  if (rules.minScore > 100) rules.issues.push('Lab Scores range from 0 to 100.');
  const target =
    prompt.match(
      /(?:around|with|target|approximately|about)\s*([+-]\d{3,5})(?:\s*(?:combined\s*)?odds)?/i,
    ) ?? prompt.match(/([+-]\d{3,5})\s*(?:combined\s*)?odds/i);
  if (target) rules.targetOdds = Number(target[1]);
  const namedTeams = TEAM_LIST.filter((t) =>
    [t.abbr, t.name, t.city, t.name.replace(`${t.city} `, '')].some((alias) =>
      contains(text, alias),
    ),
  ).map((t) => t.abbr);
  if (namedTeams.length) rules.teams = namedTeams;
  else if (base.teams.length) rules.teams = base.teams;
  if (/\bmy team\b/.test(text)) {
    if (favorite) rules.teams = [favorite];
    else rules.issues.push('Select a favorite team before using “my team”.');
  }
  if (/all (?:teams|games)|across the (?:nfl|league)/.test(text)) {
    rules.teams = [];
    rules.sameGame = false;
  }
  const playerNames = [
    ...new Set(candidates.map((m) => m.playerName).filter((n): n is string => !!n)),
  ];
  const namedPlayers = playerNames.filter(
    (n) =>
      contains(text, n) ||
      (/[a-z]/i.test(n.split(' ').at(-1)!) && contains(text, n.split(' ').at(-1)!)),
  );
  if (namedPlayers.length) rules.players = namedPlayers;
  if (
    /(?:build|building) around /.test(text) &&
    !namedTeams.length &&
    !namedPlayers.length &&
    !text.includes('my team')
  )
    rules.issues.push(
      'That player or team was not found among available props. Try a full player or team name.',
    );
  const replacement = prompt.match(
    /replace\s+(?:the\s+)?(QB|RB|WR|TE)\s+with\s+(?:a\s+)?(QB|RB|WR|TE)/i,
  );
  if (replacement) {
    rules.excludePositions = [replacement[1].toUpperCase()];
    rules.positions = rules.positions.filter((p) => p !== replacement[1].toUpperCase());
    rules.requiredPosition = replacement[2].toUpperCase();
  } else if (base.positions.length) rules.positions = base.positions;
  if (/no (?:touchdown|td)|without (?:any )?(?:touchdown|td)|remove (?:touchdown|td)/.test(text)) {
    rules.noTD = true;
    rules.tdOnly = false;
  } else if (/touchdown|\btds?\b/.test(text)) {
    rules.tdOnly = true;
    rules.noTD = false;
  }
  const markets = [
    'passing',
    'rushing',
    'receiving',
    'receptions',
    'kicking',
    'tackles',
    'sacks',
  ].filter((m) => contains(text, m));
  if (markets.length) rules.markets = markets;
  if (/same game/.test(text)) {
    rules.sameGame = true;
    rules.differentGames = false;
  }
  if (/different games/.test(text)) {
    rules.differentGames = true;
    rules.sameGame = false;
  }
  if (/\bunders?\b/.test(text)) rules.side = 'UNDER';
  else if (/\bovers?\b/.test(text)) rules.side = 'OVER';
  if (/conservative|consistent|high hit rate/.test(text)) {
    rules.conservative = true;
    rules.upside = false;
  }
  if (/upside|longer odds|plus money/.test(text)) {
    rules.upside = true;
    rules.conservative = false;
  }
  if (/\btoday\b/.test(text)) rules.today = true;
  return rules;
}
export function generateConstrainedParlay<T extends GeneratorCandidate>(
  candidates: T[],
  games: GeneratorGame[],
  rules: GeneratorRules,
  previousIds: string[] = [],
) {
  if (rules.issues.length) return { legs: [] as T[], message: rules.issues.join(' ') };
  const available = new Map(
    games
      .filter((g) => !g.marketsLocked && Date.parse(g.kickoffAt) > Date.now())
      .map((g) => [g.id, g]),
  );
  const eligible = candidates.filter((m) => {
    const game = m.eventId ? available.get(m.eventId) : undefined;
    const td = /touchdown|\btd|_td/i.test(`${m.marketType} ${m.statId}`);
    const score = m.trend?.trendScore;
    return (
      m.available &&
      game &&
      m.period === 'game' &&
      m.playerName &&
      m.playerId &&
      m.line != null &&
      Number.isFinite(m.line) &&
      m.odds != null &&
      Number.isFinite(m.odds) &&
      Math.abs(m.odds) >= 100 &&
      score != null &&
      Number.isFinite(score) &&
      score >= rules.minScore &&
      score <= 100 &&
      (!rules.teams.length || rules.teams.includes(m.teamId ?? '')) &&
      (!rules.sameGame ||
        rules.teams.length < 2 ||
        rules.teams.every((t) => t === game.homeTeamId || t === game.awayTeamId)) &&
      (!rules.positions.length || rules.positions.includes(m.position ?? '')) &&
      !rules.excludePositions.includes(m.position ?? '') &&
      !rules.excludePlayers?.includes(m.playerId!) &&
      (!rules.side || m.side === rules.side) &&
      (!rules.noTD || !td) &&
      (!rules.tdOnly || td) &&
      (!rules.markets.length ||
        rules.markets.some((s) => `${m.marketType} ${m.statId}`.toLowerCase().includes(s))) &&
      (!rules.today || new Date(game.kickoffAt).toDateString() === new Date().toDateString()) &&
      (!rules.conservative || m.trend!.last10.games >= 5)
    );
  });
  const rank = (m: T) => m.trend!.trendScore;
  const dedup = new Map<string, T>();
  for (const m of eligible.sort((a, b) => rank(b) - rank(a))) {
    const key = `${m.sportsbook}:${m.eventId}:${m.playerId}:${m.marketType}:${m.side}:${m.line}`;
    if (!dedup.has(key)) dedup.set(key, m);
  }
  const pool = [...dedup.values()];
  const players = new Set(pool.map((m) => m.playerId)).size;
  if (players < rules.legs)
    return {
      legs: [] as T[],
      message: `Only ${players} different players have available props meeting these rules${rules.minScore ? ` with Lab Scores of ${rules.minScore}+` : ''}; ${rules.legs} legs were requested.`,
    };
  for (const name of rules.players)
    if (!pool.some((m) => m.playerName === name))
      return {
        legs: [] as T[],
        message: `No available props for ${name} meet all of these rules.`,
      };
  const quality = (legs: T[]) => legs.reduce((s, m) => s + rank(m), 0);
  const tie = (legs: T[]) => {
    if (rules.targetOdds != null) {
      const actual = estimateParlayOdds(legs.map((m) => m.odds));
      return actual == null
        ? Infinity
        : Math.abs(Math.log(americanToDecimal(actual) / americanToDecimal(rules.targetOdds)));
    }
    if (rules.upside) return -legs.reduce((s, m) => s + americanToDecimal(m.odds!), 0);
    if (rules.conservative)
      return -legs.reduce(
        (s, m) => s + (m.trend!.last10.games ? m.trend!.last10.hits / m.trend!.last10.games : 0),
        0,
      );
    return 0;
  };
  const compare = (a: T[], b: T[]) => quality(b) - quality(a) || tie(a) - tie(b);
  const completed: T[][] = [];
  // Beam search stays bounded while keeping separate books/games and required-player coverage.
  for (const book of new Set(pool.map((m) => m.sportsbook))) {
    const bookPool = pool.filter((m) => m.sportsbook === book);
    const scopes = rules.sameGame ? [...new Set(bookPool.map((m) => m.eventId))] : [undefined];
    for (const eventId of scopes) {
      const scope = bookPool.filter((m) => !eventId || m.eventId === eventId);
      let beam: T[][] = [[]];
      for (let step = 0; step < rules.legs; step++) {
        const next = new Map<string, T[]>();
        for (const legs of beam)
          for (const m of scope) {
            if (legs.some((l) => l.playerId === m.playerId)) continue;
            if (rules.differentGames && legs.some((l) => l.eventId === m.eventId)) continue;
            const added = [...legs, m];
            const missing = rules.players.filter(
              (n) => !added.some((l) => l.playerName === n),
            ).length;
            if (missing > rules.legs - added.length) continue;
            if (
              added.length === rules.legs &&
              rules.requiredPosition &&
              !added.some((l) => l.position === rules.requiredPosition)
            )
              continue;
            const key = added
              .map((l) => l.id)
              .sort()
              .join('|');
            next.set(key, added);
            if (next.size >= 2400) {
              const best = [...next.entries()].sort((a, b) => compare(a[1], b[1])).slice(0, 120);
              next.clear();
              for (const [k, v] of best) next.set(k, v);
            }
          }
        beam = [...next.values()].sort(compare).slice(0, 120);
        if (!beam.length) break;
      }
      completed.push(
        ...beam.filter(
          (l) =>
            l.length === rules.legs &&
            rules.players.every((p) => l.some((m) => m.playerName === p)),
        ),
      );
    }
  }
  completed.sort(compare);
  const alternate = completed.find((l) => l.some((m) => !previousIds.includes(m.id)));
  const legs = (alternate ?? completed[0] ?? []).sort((a, b) => rank(b) - rank(a));
  return {
    legs,
    message: legs.length
      ? previousIds.length && !alternate
        ? 'No different combination currently meets these rules. Showing the best available match.'
        : ''
      : `No available ${rules.legs}-leg combination was found meeting all rules at one sportsbook. Try fewer legs, a lower minimum score, or more games.`,
  };
}

export function describeGeneratorRules(r: GeneratorRules) {
  return [
    `${r.legs} leg parlay`,
    `with all Lab Scores at least ${r.minScore}`,
    r.targetOdds != null ? `around ${r.targetOdds > 0 ? '+' : ''}${r.targetOdds} odds` : '',
    ...r.teams,
    ...r.players.map((p) => `build around ${p}`),
    r.positions.length ? `${r.positions.join(' or ')} props only` : '',
    r.requiredPosition && r.excludePositions[0]
      ? `replace the ${r.excludePositions[0]} with a ${r.requiredPosition}`
      : '',
    ...r.markets,
    r.side === 'UNDER' ? 'unders' : r.side === 'OVER' ? 'overs' : '',
    r.noTD ? 'no touchdown props' : r.tdOnly ? 'touchdown props only' : '',
    r.sameGame ? 'same-game parlay' : r.differentGames ? 'different games' : '',
    r.conservative ? 'most consistent players' : r.upside ? 'more upside' : '',
    r.today ? 'today' : '',
  ]
    .filter(Boolean)
    .join(', ');
}
