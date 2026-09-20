import { TEAM_LIST } from '@/data/teams';
import { NFL_TEAM_SEED } from '@/server/ingest/teams';
import { teamTimeZone } from '@/config/game-day-hero';
import type { SearchResponse, SearchResult } from '@/features/search/types';
import type {
  AnswerBlock,
  AnswerSource,
  SearchContext,
  SearchGame,
  InformationPlan,
} from '@/features/search/answer-types';
import * as data from './answer-data';
import { buildInformationPlan } from './intent';
import { rankBriefingEvidence, relevantNews } from './evidence';
import { classifyAmbiguousQuery, synthesizeEvidence } from './synthesis';
import { SPORTSBOOKS } from '@/server/odds/sportsbooks';
import prospects from '@/server/data/draft-prospects-2027.json';
import prospectMeta from '@/server/data/draft-prospects-2027.meta.json';

import { usableStoredOdds, selectStoredProps } from './stored-betting';
import { marketDisplayName } from '@/lib/parlay-lab/market-display';
export const teamName = (abbr: string) => TEAM_LIST.find((t) => t.abbr === abbr)?.name ?? abbr;
export function gameTime(game: SearchGame, timeZone: string) {
  const date = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone,
  }).format(new Date(game.startsAt));
  return game.timeTbd
    ? `${date}, time TBD`
    : `${date} at ${new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', timeZoneName: 'short', timeZone }).format(new Date(game.startsAt))}`;
}
export function selectGame(games: SearchGame[], plan: InformationPlan, now: Date) {
  if (plan.referenceGame) return games.find((g) => g.id === plan.referenceGame) ?? null;
  if (plan.afterGame) {
    const ref = games.find((g) => g.id === plan.afterGame);
    return ref
      ? (games.find((g) => g.startsAt > ref.startsAt && g.status !== 'postponed') ?? null)
      : null;
  }
  if (plan.intent === 'PREVIOUS_GAME')
    return games.filter((g) => g.status === 'final').at(-1) ?? null;
  if (plan.intent === 'SCORE')
    return (
      games.find((g) => g.status === 'live') ??
      games.filter((g) => g.status === 'final').at(-1) ??
      null
    );
  return (
    games.find((g) => g.status === 'scheduled' && Date.parse(g.startsAt) > now.getTime()) ?? null
  );
}
const emptyStats = {
  columns: [] as string[],
  rows: [] as string[][],
  throughWeek: null as number | null,
};
export type AnswerDependencies = Pick<
  typeof data,
  | 'loadSchedule'
  | 'loadStandings'
  | 'loadRoster'
  | 'loadInjuries'
  | 'loadOdds'
  | 'loadNews'
  | 'loadTransactions'
  | 'loadStats'
> & { synthesize: typeof synthesizeEvidence; classify: typeof classifyAmbiguousQuery };
const defaults: AnswerDependencies = {
  ...data,
  synthesize: synthesizeEvidence,
  classify: classifyAmbiguousQuery,
};

export async function answerSearch(
  input: { query: string; teamId: string; context?: SearchContext; timeZone?: string },
  deps: AnswerDependencies = defaults,
  now = new Date(),
): Promise<SearchResponse> {
  const start = Date.now();
  let plan = buildInformationPlan(input.query, input.teamId, input.context);
  if (plan.intent === 'GENERAL_TEAM_QUESTION') {
    const intent = await deps.classify(input.query);
    if (intent) plan = buildInformationPlan(input.query, input.teamId, input.context, intent);
  }
  let timeZone = input.timeZone ?? teamTimeZone(plan.teamId);
  try {
    new Intl.DateTimeFormat('en-US', { timeZone }).format(now);
  } catch {
    timeZone = teamTimeZone(plan.teamId);
  }
  const sources: AnswerSource[] = [],
    blocks: AnswerBlock[] = [],
    results: SearchResult[] = [],
    unavailable: string[] = [];
  const cite = (s: AnswerSource) => {
    let i = sources.findIndex((x) => x.id === s.id);
    if (i < 0) {
      sources.push(s);
      i = sources.length - 1;
    }
    return `[${i + 1}]`;
  };
  const safe = async <T>(name: string, fn: () => Promise<T>, fallback: T): Promise<T> => {
    try {
      return await fn();
    } catch {
      unavailable.push(name);
      return fallback;
    }
  };
  const wants = (name: InformationPlan['needs'][number]) => plan.needs.includes(name);
  const [games, standings, roster, injuries, news, stats, transactions] = await Promise.all([
    wants('schedule') ? safe('schedule', () => deps.loadSchedule(plan.teamId, now), []) : [],
    wants('standings') ? safe('standings', () => deps.loadStandings(now), null) : null,
    wants('roster') ? safe('roster', () => deps.loadRoster(plan.teamId, now), null) : null,
    wants('injuries') ? safe('injuries', () => deps.loadInjuries(plan.teamId, now), null) : null,
    wants('news') ? safe('news', () => deps.loadNews(plan.teamId, now), []) : [],
    wants('stats')
      ? safe(
          'stats',
          () => deps.loadStats(plan.teamId, data.nflSeason(now), plan.intent === 'PLAYER_STATS'),
          emptyStats,
        )
      : emptyStats,
    wants('transactions')
      ? safe('transactions', () => deps.loadTransactions(plan.teamId, now), [])
      : [],
  ]);
  let game = selectGame(games, plan, now),
    lead = '';
  const name = teamName(plan.teamId),
    intent = plan.intent;
  const gameSentence = (g: SearchGame) =>
    `${name} ${g.home === plan.teamId ? 'host' : 'visit'} the ${teamName(g.home === plan.teamId ? g.away : g.home)} ${gameTime(g, timeZone)}${g.venue ? ` at ${g.venue}` : ''}.${g.network ? ` TV: ${g.network}.` : ''} ${cite(g.source)}`;
  const currentStanding = standings?.rows.find((s) => s.team === plan.teamId);
  const record = (s: data.Standing) => `${s.wins}–${s.losses}${s.ties ? `–${s.ties}` : ''}`;
  const briefing = ['TEAM_BRIEFING', 'CATCH_ME_UP'].includes(intent);
  let selectedNews = briefing ? news : relevantNews(input.query, news, name);
  if (
    ['NEWS', 'BREAKING_NEWS'].includes(intent) &&
    /^(latest\s+)?(news|breaking news|updates)[.!?]?$/i.test(input.query.trim())
  )
    selectedNews = news;
  if (['INJURIES', 'PLAYER_STATUS'].includes(intent))
    selectedNews = news.filter((n) => /injur/i.test(n.category));
  if (intent === 'TRANSACTIONS')
    selectedNews = news.filter((n) => /transaction|roster_move|signing|trade/i.test(n.category));
  const ranked = rankBriefingEvidence(selectedNews, now);
  if (intent === 'BREAKING_NEWS')
    ranked.news = ranked.news.filter((n) => n.sources.some((s) => s.tier === 'A'));
  const addNewsSources = () =>
    ranked.news.map((n) => {
      const primary = n.sources[0];
      const s: AnswerSource = {
        ...primary,
        id: n.id,
        related: n.sources.slice(1, 4).map((x) => ({ title: x.title, url: x.url })),
      };
      const marker = cite(s);
      results.push({
        id: n.id,
        teamId: plan.teamId,
        type: 'story',
        title: n.title,
        summary: n.summary,
        url: primary.url,
        sourceName: primary.provider ?? null,
        sourceUrl: primary.url,
        publishedAt: n.publishedAt,
        updatedAt: n.publishedAt,
        image: null,
        score: n.importance,
        canonicalStoryId: n.id,
        metadata: { sourceCount: n.sources.length },
      });
      return { ...n, marker };
    });
  if (plan.ambiguous) {
    lead =
      'Which game do you mean? Ask for the next game first, then “who do they play after that?”';
    game = null;
  } else if (['NEXT_GAME', 'FOLLOW_UP', 'SCHEDULE'].includes(intent)) {
    if (!game)
      lead = `A verified upcoming game for ${name} isn't available right now${plan.afterGame ? ' after the previously referenced matchup' : ''}.`;
    else {
      lead = gameSentence(game);
      blocks.push({ type: 'gameCard', game, timeZone });
      const upcoming = games
        .filter((g) => g.startsAt > game!.startsAt && g.status === 'scheduled')
        .slice(0, intent === 'SCHEDULE' ? 18 : 2);
      if (upcoming.length) blocks.push({ type: 'schedule', games: upcoming, timeZone });
    }
  } else if (['SCORE', 'PREVIOUS_GAME'].includes(intent)) {
    if (!game)
      lead = `A verified ${intent === 'SCORE' ? 'score' : 'previous game result'} for ${name} isn't available right now.`;
    else {
      lead =
        game.status === 'final' || game.status === 'live'
          ? game.homeScore !== null && game.awayScore !== null
            ? `${teamName(game.away)} ${game.awayScore}, ${teamName(game.home)} ${game.homeScore} — ${game.status === 'final' ? 'final' : 'in progress'}. ${cite(game.source)}`
            : `The score for this game isn't available right now.`
          : `This game has not started. ${gameSentence(game)}`;
      blocks.push({ type: 'gameCard', game, timeZone });
    }
  } else if (intent === 'BETTING_ANALYSIS') {
    lead =
      "Historical betting performance is different from the latest betting line. I don't have a verified historical hit-rate calculation for that question yet.";
  } else if (['ODDS', 'TOTAL', 'SPREAD', 'MONEYLINE', 'PLAYER_PROPS'].includes(intent)) {
    const all =
      game && game.status === 'scheduled' && Date.parse(game.startsAt) > now.getTime()
        ? await safe('odds', () => deps.loadOdds(game!), [])
        : [];
    const usable = usableStoredOdds(all, now).sort((a, b) =>
      b.updatedAt.localeCompare(a.updatedAt),
    );
    const favored = /favou?red|favou?rite/i.test(input.query);
    const candidates =
      intent === 'PLAYER_PROPS'
        ? selectStoredProps(input.query, usable).sort(
            (a, b) => Number(Boolean(a.isAltLine)) - Number(Boolean(b.isAltLine)),
          )
        : usable.filter(
            (l) => !l.playerName && ['TOTAL', 'SPREAD', 'MONEYLINE'].includes(l.market),
          );
    const primary =
      candidates.find(
        (l) => intent === 'ODDS' || intent === 'PLAYER_PROPS' || l.market === intent,
      ) ?? (favored ? candidates.find((l) => l.market === 'MONEYLINE') : undefined);
    let renderedLines: data.OddsLine[] = [];
    if (!game || !primary)
      lead = `I don't have a stored ${intent === 'PLAYER_PROPS' ? 'player prop matching that question' : 'betting line'} for ${name}${plan.referenceGame ? ' in that matchup' : "' next game"} yet. Check back after the next scheduled odds update.`;
    else {
      const bookLines = candidates.filter((l) => l.sportsbook === primary.sportsbook);
      const total = bookLines.find((l) => l.market === 'TOTAL');
      const spread = bookLines.find((l) => l.market === 'SPREAD');
      const lines = [
        ...new Map(
          bookLines
            .filter(
              (l) =>
                (l.market !== 'TOTAL' || l.line === total?.line) &&
                (l.market !== 'SPREAD' || Math.abs(l.line!) === Math.abs(spread?.line ?? NaN)),
            )
            .reverse()
            .map((l) => [
              `${l.playerName ?? ''}:${l.market}:${l.selection}:${intent === 'PLAYER_PROPS' ? l.line : ''}`,
              l,
            ]),
        ).values(),
      ];
      if (intent === 'PLAYER_PROPS')
        lines.sort((a, b) => Number(Boolean(a.isAltLine)) - Number(Boolean(b.isAltLine)));
      lines.splice(20);
      renderedLines = lines;
      const book = SPORTSBOOKS.find((b) => b.id === primary.sportsbook)!;
      const updatedAt = lines.map((l) => l.updatedAt).sort()[0];
      const marker = cite({
        id: `odds:${game.id}:${book.id}`,
        title: `${game.away} at ${game.home} stored betting data`,
        url: primary.eventId
          ? `/parlay-lab/game/${encodeURIComponent(primary.eventId)}/markets`
          : '/parlay-lab',
        provider: `Betting data · ${book.name}`,
        updatedAt,
      });
      const selected = lines.filter(
        (l) => intent === 'ODDS' || intent === 'PLAYER_PROPS' || l.market === primary.market,
      );
      const describe = (l: data.OddsLine) =>
        `${l.playerName ? `${l.playerName} ${marketDisplayName(l.market)}${l.isAltLine ? ' (alternate)' : ''} — ` : ''}${l.selection} ${l.line === null ? '' : `${l.line > 0 && l.market === 'SPREAD' ? '+' : ''}${l.line} `}(${l.price > 0 ? '+' : ''}${l.price})`;
      lead =
        intent === 'TOTAL'
          ? `The latest stored ${game.away}–${game.home} over/under at ${book.name} is ${primary.line} points. ${selected.map(describe).join('; ')}. ${marker}`
          : `${game.away}–${game.home} — latest stored ${intent === 'PLAYER_PROPS' ? 'player props' : intent.toLowerCase()} at ${book.name}: ${selected
              .slice(0, intent === 'PLAYER_PROPS' ? 2 : 6)
              .map(describe)
              .join('; ')}. ${marker}`;
      if (favored) {
        const moneylines = lines
          .filter((l) => l.market === 'MONEYLINE')
          .sort((a, b) => a.price - b.price);
        const favorite =
          selected.find((l) => l.market === 'SPREAD' && l.line !== null && l.line < 0) ??
          (moneylines.length === 2 && moneylines[0].price !== moneylines[1].price
            ? moneylines[0]
            : undefined);
        const subject = /\b(who|which)\b/i.test(input.query) ? null : plan.teamId;
        if (favorite && [game.home, game.away].includes(favorite.selection))
          lead = `${subject ? (favorite.selection === subject ? 'Yes. ' : 'No. ') : ''}${teamName(favorite.selection)} are favored in the latest stored ${book.name} ${favorite.market === 'SPREAD' ? 'spread' : 'moneyline'}: ${describe(favorite)}. ${marker}`;
        else
          lead = `The available stored lines do not establish a clear favorite for ${game.away}–${game.home}. ${marker}`;
      }
      const age = Math.max(0, Math.floor((now.getTime() - Date.parse(updatedAt)) / 3600000));
      lead += ` Odds last updated ${new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short', timeZone }).format(new Date(updatedAt))}.${age >= 3 ? ` These stored prices are ${age} hours old and may have changed.` : ''}`;
      if (intent === 'PLAYER_PROPS')
        blocks.push({
          type: 'statTable',
          title: 'Stored player props (up to 20 selections)',
          columns: ['Player', 'Market', 'Selection', 'Line', 'Price', 'Updated'],
          rows: lines.map((l) => [
            l.playerName!,
            `${marketDisplayName(l.market)}${l.isAltLine ? ' (alternate)' : ''}`,
            l.selection,
            String(l.line ?? '—'),
            String(l.price),
            new Intl.DateTimeFormat('en-US', {
              month: 'short',
              day: 'numeric',
              hour: 'numeric',
              minute: '2-digit',
              timeZoneName: 'short',
              timeZone,
            }).format(new Date(l.updatedAt)),
          ]),
        });
      else
        blocks.push({
          type: 'oddsCard',
          game,
          provider: `Betting data · ${book.name}`,
          updatedAt,
          timeZone,
          lines: lines.map((l) => ({
            market: l.market,
            selection: l.selection,
            line: l.line,
            price: l.price,
          })),
        });
    }
    if (process.env.NODE_ENV !== 'production')
      console.info(
        '[AI Search]',
        JSON.stringify({
          intent,
          team: plan.teamId,
          game: game?.id ?? null,
          betting_source: 'stored',
          result: renderedLines.length ? 'found' : 'no_data',
          odds_age_minutes: renderedLines.length
            ? Math.max(
                ...renderedLines.map((l) =>
                  Math.floor((now.getTime() - Date.parse(l.updatedAt)) / 60000),
                ),
              )
            : null,
          external_fetch: false,
        }),
      );
  } else if (['STANDINGS', 'TEAM_RECORD', 'PLAYOFF_OUTLOOK', 'COMPARISON'].includes(intent)) {
    if (!currentStanding || !standings)
      lead = `Current standings for ${name} aren't available right now.`;
    else {
      lead = `${name} are ${record(currentStanding)} in the ${currentStanding.season} regular season${currentStanding.seed ? `, with ${currentStanding.conference} seed ${currentStanding.seed}` : ''}. ${cite(standings.source)}`;
      const rows = standings.rows
        .filter((s) =>
          intent === 'COMPARISON'
            ? [plan.teamId, plan.comparisonTeam].includes(s.team)
            : s.conference === currentStanding.conference,
        )
        .sort((a, b) => (a.seed ?? 99) - (b.seed ?? 99));
      blocks.push({
        type: 'standingsSnippet',
        title: intent === 'COMPARISON' ? 'Team records' : `${currentStanding.conference} standings`,
        columns: ['Team', 'W', 'L', 'T', 'Seed'],
        rows: rows.map((s) => [
          teamName(s.team),
          String(s.wins),
          String(s.losses),
          String(s.ties),
          String(s.seed ?? '—'),
        ]),
      });
      if (intent === 'PLAYOFF_OUTLOOK') {
        blocks.push({
          type: 'paragraph',
          text: 'These are current standings, not a playoff projection. Verified playoff probabilities and clinching scenarios are not available.',
        });
        const division = NFL_TEAM_SEED.find((t) => t.abbreviation === plan.teamId);
        const divisionTeams = new Set(
          NFL_TEAM_SEED.filter(
            (t) => t.conference === division?.conference && t.division === division?.division,
          ).map((t) => t.abbreviation),
        );
        blocks.push({
          type: 'standingsSnippet',
          title: `${division?.conference ?? ''} ${division?.division ?? ''} records`,
          columns: ['Team', 'Record'],
          rows: rows
            .filter((s) => divisionTeams.has(s.team))
            .map((s) => [teamName(s.team), record(s)]),
        });
        const remaining = games.filter(
          (g) => g.status === 'scheduled' && Date.parse(g.startsAt) > now.getTime(),
        );
        if (remaining.length) blocks.push({ type: 'schedule', games: remaining, timeZone });
      }
      if (intent === 'COMPARISON' && !plan.comparisonTeam)
        blocks.push({ type: 'paragraph', text: 'Which other team would you like to compare?' });
    }
  } else if (['INJURIES', 'PLAYER_STATUS'].includes(intent)) {
    const matching =
      injuries?.rows.filter(
        (r) =>
          intent === 'INJURIES' ||
          r.name
            .toLowerCase()
            .split(' ')
            .filter((w) => w.length > 2)
            .some((w) => input.query.toLowerCase().includes(w)),
      ) ?? [];
    if (intent === 'PLAYER_STATUS' && matching.length > 1) {
      lead = `Which player do you mean: ${matching.map((p) => p.name).join(', ')}?`;
    } else if (matching.length && injuries) {
      lead =
        intent === 'PLAYER_STATUS'
          ? `${matching[0].name} is listed as ${matching[0].status.toLowerCase()}. ${cite(injuries.source)}`
          : `The current ${name} injury report lists ${matching.length} players. ${cite(injuries.source)}`;
      blocks.push({
        type: 'injuryList',
        title: 'Injury report',
        columns: ['Player', 'Position', 'Status', 'Reported'],
        rows: matching.map((r) => [r.name, r.position, r.status, r.date]),
      });
    } else
      lead =
        intent === 'PLAYER_STATUS'
          ? "I don't have a verified current injury designation for that player. That does not confirm they will play."
          : `No verified recent injury designations for ${name} are available right now.`;
    if (ranked.news.length) {
      const supporting = addNewsSources();
      blocks.push({
        type: 'bulletList',
        title: 'Related injury reporting',
        items: supporting.map((n) => `${n.title} ${n.marker}`),
      });
    }
  } else if (intent === 'ROSTER') {
    if (!roster?.players.length) lead = `The current ${name} roster isn't available right now.`;
    else {
      lead = `The current ${name} roster has ${roster.players.length} listed players. ${cite(roster.source)}`;
      blocks.push({
        type: 'roster',
        title: 'Roster',
        columns: ['Player', 'Position'],
        rows: roster.players.map((p) => [p.name, p.position]),
      });
    }
  } else if (['PLAYER_STATS', 'TEAM_STATS'].includes(intent)) {
    let rows = stats.rows;
    if (intent === 'PLAYER_STATS' && !/rookie/i.test(input.query)) {
      const matches = rows.filter((r) =>
        r[0]
          .toLowerCase()
          .split(' ')
          .filter((w) => w.length > 2)
          .some((w) => input.query.toLowerCase().includes(w)),
      );
      if (matches.length) rows = matches;
      else if (!/^(player\s+)?(stats|statistics)[?! .]*$/i.test(input.query)) rows = [];
    }
    if (/rookie/i.test(input.query)) {
      const rookies = new Set(
        roster?.players.filter((p) => p.experience === 0).map((p) => p.name.toLowerCase()) ?? [],
      );
      rows = rows.filter((r) => rookies.has(r[0].toLowerCase()));
    }
    if (
      /career|all.time|snap counts|sacks|last game|last week/i.test(input.query) ||
      (input.query.match(/\b20\d{2}\b/)?.[0] &&
        Number(input.query.match(/\b20\d{2}\b/)![0]) !== data.nflSeason(now))
    )
      rows = [];
    if (!rows.length)
      lead =
        'Verified stats answering that question are not available in the imported dataset right now.';
    else {
      const s: AnswerSource = {
        id: `stats:${plan.teamId}:${data.nflSeason(now)}`,
        title: `${data.nflSeason(now)} imported NFL stats`,
        url: 'https://github.com/nflverse/nflverse-data/releases/tag/player_stats',
        provider: 'nflverse',
      };
      lead = `Here are the imported ${data.nflSeason(now)} regular-season ${intent === 'PLAYER_STATS' ? 'player' : 'team'} stats for ${name}${stats.throughWeek ? ` through Week ${stats.throughWeek}` : ''}. ${cite(s)}`;
      const requestedMetric = /passing.*(touchdown|td)/i.test(input.query)
        ? 'Pass TD'
        : /rushing.*(touchdown|td)/i.test(input.query)
          ? 'Rush TD'
          : /receiving.*(touchdown|td)/i.test(input.query)
            ? 'Rec TD'
            : /passing.*yards/i.test(input.query)
              ? 'Pass yds'
              : /rushing.*yards/i.test(input.query)
                ? 'Rush yds'
                : /receiving.*yards/i.test(input.query)
                  ? 'Rec yds'
                  : /receptions/i.test(input.query)
                    ? 'Receptions'
                    : null;
      if (rows.length === 1 && requestedMetric) {
        const value = rows[0][stats.columns.indexOf(requestedMetric)];
        if (value && value !== '—')
          lead = `${rows[0][0]} has ${value} ${requestedMetric.toLowerCase()} in the imported ${data.nflSeason(now)} regular-season data${stats.throughWeek ? ` through Week ${stats.throughWeek}` : ''}. ${cite(s)}`;
      }
      if (/rookie/i.test(input.query)) {
        const rookieNames = rows.map((r) => r[0].toLowerCase());
        ranked.news = rankBriefingEvidence(
          news.filter((n) =>
            rookieNames.some((p) => `${n.title} ${n.summary}`.toLowerCase().includes(p)),
          ),
          now,
        ).news;
        const reports = addNewsSources();
        const evidence = [
          {
            id: s.id,
            content: `Imported ${data.nflSeason(now)} season totals through Week ${stats.throughWeek ?? 'unknown'}: ${rows.map((r) => r.map((v, i) => `${stats.columns[i]}: ${v}`).join(', ')).join('; ')}. These totals do not establish recent trends or snap counts.`,
          },
          ...reports.map((n) => ({ id: n.id, content: `${n.title}. ${n.summary}` })),
        ];
        const claims = await deps.synthesize(input.query, name, evidence, false);
        if (claims?.length) {
          lead = claims
            .map(
              (c) =>
                `${c.text} ${c.evidenceIds.map((id) => `[${sources.findIndex((source) => source.id === id) + 1}]`).join('')}`,
            )
            .join(' ');
        } else
          blocks.push({
            type: 'paragraph',
            text: 'These totals show recorded production by current-roster rookies. Snap counts and recent trends are not available in this dataset, so a complete impact assessment is unavailable.',
          });
      }
      blocks.push({
        type: 'statTable',
        title: 'Imported stats (not live)',
        columns: stats.columns,
        rows,
      });
    }
  } else if (intent === 'PROSPECTS') {
    lead = `This prospect board is for ${prospectMeta.draftYear}, last updated ${prospectMeta.sourceUpdatedAt.slice(0, 10)}. ${cite({ id: 'prospects', title: `${prospectMeta.draftYear} prospect rankings`, url: prospectMeta.source, provider: 'Tankathon', updatedAt: prospectMeta.sourceUpdatedAt })}`;
    blocks.push({
      type: 'statTable',
      title: 'Draft prospects',
      columns: ['Rank', 'Player', 'Position', 'School'],
      rows: prospects.slice(0, 20).map((p) => [String(p.sourceRank), p.name, p.position, p.school]),
    });
  } else if (intent === 'TRANSACTIONS') {
    if (transactions.length) {
      lead = `Recent official ${name} roster moves include ${transactions[0].description.toLowerCase()} — ${transactions[0].name} (${transactions[0].date}). ${cite(transactions[0].source)}`;
      blocks.push({
        type: 'transactionList',
        title: 'Recent official ledger entries',
        columns: ['Date', 'Player', 'Move', 'From → To'],
        rows: transactions
          .slice(0, 20)
          .map((t) => [
            t.date,
            t.name,
            `${t.description} ${cite(t.source)}`,
            `${t.from ?? '—'} → ${t.to ?? '—'}`,
          ]),
      });
    } else {
      lead = `Verified recent roster moves for ${name} aren't available right now.`;
      const developments = addNewsSources();
      if (developments.length)
        blocks.push({
          type: 'bulletList',
          title: 'Related reporting',
          items: developments.map((n) => `${n.title} ${n.marker}`),
        });
    }
  } else {
    const developments = addNewsSources();
    const evidence = developments.map((n) => ({
      id: n.id,
      content: `${n.title}\n${n.summary}\nReported ${n.publishedAt}`,
    }));
    if (briefing && currentStanding && standings)
      evidence.push({
        id: standings.source.id,
        content: `${name} are ${record(currentStanding)} in ${currentStanding.season}.`,
      });
    if (briefing && game) evidence.push({ id: game.source.id, content: gameSentence(game) });
    const lastGame = games.filter((g) => g.status === 'final').at(-1);
    if (briefing && lastGame && lastGame.homeScore !== null && lastGame.awayScore !== null) {
      cite(lastGame.source);
      const result = `${teamName(lastGame.away)} ${lastGame.awayScore}, ${teamName(lastGame.home)} ${lastGame.homeScore} — final (${gameTime(lastGame, timeZone)}).`;
      evidence.push({ id: lastGame.source.id, content: result });
      blocks.push({ type: 'paragraph', text: `Last game: ${result} ${cite(lastGame.source)}` });
    }
    if (briefing && currentStanding && standings) cite(standings.source);
    if (briefing && injuries?.rows.length) {
      cite(injuries.source);
      evidence.push({
        id: injuries.source.id,
        content: injuries.rows
          .slice(0, 5)
          .map((r) => `${r.name}: ${r.status}, reported ${r.date}.`)
          .join(' '),
      });
    }
    if (briefing)
      for (const t of transactions.slice(0, 5)) {
        cite(t.source);
        evidence.push({ id: t.source.id, content: `${t.date}: ${t.name}, ${t.description}.` });
      }
    const groupedEvidence = new Map<string, string>();
    for (const entry of evidence)
      groupedEvidence.set(
        entry.id,
        `${groupedEvidence.get(entry.id) ?? ''} ${entry.content}`.trim(),
      );
    const generated = await deps.synthesize(
      input.query,
      name,
      [...groupedEvidence].map(([id, content]) => ({ id, content })),
      briefing,
    );
    if (generated?.length) {
      const render = (c: (typeof generated)[number]) =>
        `${c.text} ${c.evidenceIds.map((id) => `[${sources.findIndex((s) => s.id === id) + 1}]`).join('')}`;
      lead = render(generated[0]);
      if (generated[1]) blocks.push({ type: 'paragraph', text: render(generated[1]) });
      if (generated.length > 2)
        blocks.push({
          type: 'bulletList',
          title: briefing ? 'What matters' : 'Key points',
          items: generated.slice(2).map(render),
        });
    } else if (briefing) {
      lead =
        currentStanding && standings
          ? `${name} are ${record(currentStanding)} in the ${currentStanding.season} regular season. ${cite(standings.source)}`
          : `Here's the verified ${name} update.`;
      if (developments.length) {
        const categories = [
          ...new Set(
            developments.map((n) =>
              /injur/i.test(n.category)
                ? 'injuries'
                : /trade|transaction|roster/i.test(n.category)
                  ? 'roster changes'
                  : /coach/i.test(n.category)
                    ? 'coaching'
                    : 'team developments',
            ),
          ),
        ];
        lead += ` Recent reporting focuses on ${categories.join(' and ')}. ${developments.map((n) => n.marker).join('')}`;
        blocks.push({
          type: 'bulletList',
          title: `What matters · last ${ranked.windowHours} hours`,
          items: developments.map((n) => `${n.title} ${n.marker}`),
        });
      } else lead += ' No sufficiently supported developments were found in the last 72 hours.';
    } else {
      lead =
        intent === 'DRAFT_PICKS'
          ? 'Verified current draft-pick ownership is not connected. I won’t substitute simulated franchise picks.'
          : "I don't have enough verified evidence to directly answer that question right now.";
      if (developments.length)
        blocks.push({
          type: 'bulletList',
          title: 'Related reporting (not a verified answer)',
          items: developments.map((n) => `${n.title} ${n.marker}`),
        });
    }
    if (briefing) {
      const recentMoves = transactions
        .filter((t) => Date.parse(t.date) >= now.getTime() - 72 * 3600000)
        .slice(0, 5);
      if (recentMoves.length)
        blocks.push({
          type: 'transactionList',
          title: 'Recent roster moves',
          columns: ['Date', 'Player', 'Move'],
          rows: recentMoves.map((t) => [t.date, t.name, `${t.description} ${cite(t.source)}`]),
        });
      if (injuries?.rows.length) {
        cite(injuries.source);
        blocks.push({
          type: 'injuryList',
          title: 'Injuries to monitor',
          columns: ['Player', 'Status', 'Reported'],
          rows: injuries.rows.slice(0, 5).map((r) => [r.name, r.status, r.date]),
        });
      }
      if (game) {
        blocks.push(
          { type: 'paragraph', text: `Next: ${gameSentence(game)}` },
          { type: 'gameCard', game, timeZone },
        );
      } else blocks.push({ type: 'paragraph', text: 'The next game could not be verified.' });
    }
  }
  const context: SearchContext = {
    selectedTeamId: input.teamId,
    currentTeam: plan.teamId,
    lastIntent: intent,
    lastAnswerEntities: ranked.news.flatMap((n) => n.entities).slice(0, 12),
    ...(game
      ? {
          lastReferencedGame: game.id,
          lastResolvedOpponent: game.home === plan.teamId ? game.away : game.home,
        }
      : input.context?.currentTeam === plan.teamId && input.context?.selectedTeamId === input.teamId
        ? {
            lastReferencedGame: input.context.lastReferencedGame,
            lastResolvedOpponent: input.context.lastResolvedOpponent,
          }
        : {}),
  };
  return {
    query: input.query,
    answer: lead,
    lead,
    answerType: intent,
    blocks,
    context,
    sources,
    results,
    timing: {
      totalMs: Date.now() - start,
      lexicalMs: 0,
      vectorMs: null,
      answerMs: Date.now() - start,
    },
    availability: { unavailable, newsWindowHours: ranked.windowHours },
  };
}
