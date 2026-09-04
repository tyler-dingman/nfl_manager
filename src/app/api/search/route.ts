import { NextResponse } from 'next/server';
import { z } from 'zod';

import { TEAM_LIST } from '@/data/teams';
import { checkRateLimit } from '@/server/auth/rate-limit';
import { hybridSearch } from '@/server/search/retrieval';

export const dynamic = 'force-dynamic';

const schema = z.object({
  query: z.string().trim().min(2).max(300),
  teamId: z.string().trim().toUpperCase(),
  limit: z.number().int().min(1).max(25).optional(),
  includeAnswer: z.boolean().optional(),
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
  try {
    return NextResponse.json(await hybridSearch(parsed.data));
  } catch (error) {
    console.error('[search] request failed', error);
    return NextResponse.json({ error: 'Search is temporarily unavailable.' }, { status: 503 });
  }
}
