import { NextRequest, NextResponse } from 'next/server';

import type { SourceDefinition } from '@/data/sources';
import {
  addRegisteredSource,
  listRegisteredSources,
  updateRegisteredSource,
} from '@/server/source-registry';
import { authError } from '@/server/auth/http';
import { currentUser } from '@/server/auth/request';
import { isAllowedAdminUser } from '@/server/admin/authorization';

export const dynamic = 'force-dynamic';

const adminEnabled = () =>
  process.env.NODE_ENV !== 'production' || process.env.SOURCE_ADMIN_ENABLED === 'true';

const unavailable = () =>
  NextResponse.json({ error: 'Source admin is disabled.' }, { status: 404 });

async function requireSourceAdmin(request: NextRequest) {
  if (!adminEnabled()) return null;
  const user = await currentUser(request);
  if (!isAllowedAdminUser(user?.id, process.env.ADMIN_USER_IDS ?? '')) return null;
  return user;
}

export async function GET(request: NextRequest) {
  if (!adminEnabled()) return unavailable();
  if (!(await requireSourceAdmin(request))) return authError('Admin access required.', 403);
  const team = new URL(request.url).searchParams.get('team');
  return NextResponse.json({ sources: listRegisteredSources(team) });
}

export async function POST(request: NextRequest) {
  if (!adminEnabled()) return unavailable();
  if (!(await requireSourceAdmin(request))) return authError('Admin access required.', 403);
  const input = (await request.json()) as SourceDefinition;
  if (!input.id || !input.displayName || !input.category) {
    return NextResponse.json(
      { error: 'id, displayName, and category are required.' },
      { status: 400 },
    );
  }
  try {
    return NextResponse.json({ source: addRegisteredSource(input) }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to add source.' },
      { status: 409 },
    );
  }
}

export async function PATCH(request: NextRequest) {
  if (!adminEnabled()) return unavailable();
  if (!(await requireSourceAdmin(request))) return authError('Admin access required.', 403);
  const input = (await request.json()) as { id?: string; changes?: Partial<SourceDefinition> };
  if (!input.id || !input.changes) {
    return NextResponse.json({ error: 'id and changes are required.' }, { status: 400 });
  }
  const source = updateRegisteredSource(input.id, input.changes);
  return source
    ? NextResponse.json({ source })
    : NextResponse.json({ error: 'Source not found.' }, { status: 404 });
}
