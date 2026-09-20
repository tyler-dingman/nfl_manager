import { NextResponse } from 'next/server';
import { z } from 'zod';

import { answerSearch } from '@/server/search/answer-engine';
import { SEARCH_INTENTS } from '@/features/search/answer-types';

import { TEAM_LIST } from '@/data/teams';
import { checkRateLimit } from '@/server/auth/rate-limit';
import { hybridSearch } from '@/server/search/retrieval';
import { fallbackTeamSearch } from '@/server/search/fallback';

export const dynamic = 'force-dynamic';

const schema = z.object({
  query: z.string().trim().min(2).max(300),
  teamId: z.string().trim().toUpperCase(),
  limit: z.number().int().min(1).max(25).optional(),
  includeAnswer: z.boolean().optional(),
  timeZone: z.string().max(80).optional(),
  context: z
    .object({
      selectedTeamId: z.string().max(4),
      currentTeam: z
        .string()
        .max(4)
        .refine((value) => TEAM_LIST.some((t) => t.abbr === value)),
      lastResolvedOpponent: z.string().max(4).optional(),
      lastReferencedGame: z.string().max(80).optional(),
      lastIntent: z.enum(SEARCH_INTENTS).optional(),
      lastAnswerEntities: z.array(z.string().max(100)).max(12).optional(),
    })
    .optional(),
});

export async function POST(request: Request) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  if (!checkRateLimit(`search:${ip}`, 60, 60_000)) {
    return NextResponse.json(
      { error: 'Too many searches. Please try again shortly.' },
      { status: 429 },
    );
  }
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || !TEAM_LIST.some((team) => team.abbr === parsed.data.teamId)) {
    return NextResponse.json({ error: 'Invalid search request.' }, { status: 400 });
  }
  if (parsed.data.includeAnswer) {
    try {
      return NextResponse.json(await answerSearch(parsed.data), {
        headers: { 'Cache-Control': 'no-store' },
      });
    } catch (error) {
      console.error('[search] answer pipeline failed', error);
      return NextResponse.json(
        { error: 'Verified answers are temporarily unavailable. Please try again.' },
        { status: 503 },
      );
    }
  }
  try {
    const result = await hybridSearch(parsed.data);
    if (result.results.length) return NextResponse.json(result);
    return NextResponse.json(
      await fallbackTeamSearch({
        ...parsed.data,
        limit: parsed.data.limit ?? 12,
        includeAnswer: parsed.data.includeAnswer ?? false,
      }),
    );
  } catch (error) {
    console.warn('[search] indexed retrieval unavailable; using direct team search', error);
    try {
      return NextResponse.json(
        await fallbackTeamSearch({
          ...parsed.data,
          limit: parsed.data.limit ?? 12,
          includeAnswer: parsed.data.includeAnswer ?? false,
        }),
      );
    } catch (fallbackError) {
      console.error('[search] fallback request failed', fallbackError);
      return NextResponse.json({ error: 'Search is temporarily unavailable.' }, { status: 503 });
    }
  }
}
