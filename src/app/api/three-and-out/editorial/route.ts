import { NextResponse } from 'next/server';

import { saveEditorialOverride } from '@/features/three-and-out/editorial-store';
import type { EditorialOverride } from '@/features/three-and-out/types';

type EditorialBody = { teamId?: string; override?: EditorialOverride };

export async function POST(request: Request) {
  const body = (await request.json()) as EditorialBody;
  if (!body.teamId || !body.override?.storyId || !body.override.editorId) {
    return NextResponse.json(
      { error: 'teamId and a valid editorial override are required.' },
      { status: 400 },
    );
  }
  return NextResponse.json(
    { override: saveEditorialOverride(body.teamId, body.override) },
    { status: 201 },
  );
}
