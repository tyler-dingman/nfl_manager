import { NextResponse } from 'next/server';

import { persistOverride } from '@/server/three-and-out/overrides';
import { applicationBackend, applicationEnvironment } from '@/server/persistence/bindings';
import { currentUser } from '@/server/auth/request';
import { assertSameOrigin } from '@/server/auth/http';
import { NextRequest } from 'next/server';
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
  if (applicationBackend() === 'd1') {
    try {
      assertSameOrigin(new NextRequest(request.url, { headers: request.headers }));
    } catch {
      return NextResponse.json({ error: 'Invalid origin' }, { status: 403 });
    }
    const user = await currentUser(new NextRequest(request.url, { headers: request.headers }));
    if (
      !user ||
      !(applicationEnvironment().EDITORIAL_ADMIN_USER_IDS ?? '').split(',').includes(user.id)
    )
      return NextResponse.json({ error: 'Editorial permission required' }, { status: 403 });
    if (
      !['PROMOTE', 'DEMOTE', 'PIN_FIRST', 'REMOVE', 'SET_STATUS', 'EDIT'].includes(
        body.override.action,
      )
    )
      return NextResponse.json({ error: 'Invalid editorial action' }, { status: 400 });
    body.override = { ...body.override, editorId: user.id, createdAt: new Date().toISOString() };
  }
  return NextResponse.json(
    { override: await persistOverride(body.teamId.toUpperCase(), body.override) },
    { status: 201 },
  );
}
