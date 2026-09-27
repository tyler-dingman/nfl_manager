import { NextResponse } from 'next/server';
import { unstable_cache } from 'next/cache';
import { TEAM_LIST } from '@/data/teams';
import { loadSchedule, loadNews, loadInjuries } from '@/server/search/answer-data';
import { contextualSearchQuestions } from '../../../../../packages/search/suggestions';
import { checkRateLimit } from '@/server/auth/rate-limit';

const suggestionsForTeam = unstable_cache(
  async (teamId: string) => {
    const team = TEAM_LIST.find((t) => t.abbr === teamId)!;
    const now = new Date();
    const [schedule, reporting, injuries] = await Promise.allSettled([
      loadSchedule(teamId, now),
      loadNews(teamId, now),
      loadInjuries(teamId, now),
    ]);
    const games = schedule.status === 'fulfilled' ? schedule.value : [];
    const news = reporting.status === 'fulfilled' ? reporting.value : [];
    return contextualSearchQuestions({
      teamName: team.name.startsWith(`${team.city} `)
        ? team.name.slice(team.city.length + 1)
        : team.name,
      nextGame: games.some(
        (g) => g.status === 'scheduled' && Date.parse(g.startsAt) > now.getTime(),
      ),
      previousGame: games.some(
        (g) =>
          g.status === 'final' &&
          Date.parse(g.startsAt) <= now.getTime() &&
          Date.parse(g.startsAt) >= now.getTime() - 45 * 86400000,
      ),
      injuries: injuries.status === 'fulfilled' && injuries.value.rows.length > 0,
      recentNews: news.length > 0,
      todayNews: news.some((n) => Date.parse(n.publishedAt) >= now.getTime() - 24 * 3600000),
    });
  },
  ['ai-search-suggestions'],
  { revalidate: 120 },
);

export async function GET(request: Request) {
  const team = new URL(request.url).searchParams.get('team')?.toUpperCase();
  if (!team || !TEAM_LIST.some((t) => t.abbr === team))
    return NextResponse.json({ suggestions: [] });
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  if (!checkRateLimit(`search-suggestions:${ip}`, 60, 60000))
    return NextResponse.json({ suggestions: [] }, { status: 429 });
  try {
    return NextResponse.json({ suggestions: await suggestionsForTeam(team) });
  } catch {
    return NextResponse.json({ suggestions: [] });
  }
}
