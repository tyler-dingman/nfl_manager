import { NextRequest, NextResponse } from 'next/server';
import { assertSameOrigin, authError } from '@/server/auth/http';
import { listSessions, revokeAllSessions } from '@/server/auth/repository';
import { currentUser } from '@/server/auth/request';
export async function GET(request: NextRequest) {
  const user = await currentUser(request);
  return user
    ? NextResponse.json({ ok: true, sessions: await listSessions(user.id) })
    : authError('Unauthorized.', 401);
}
export async function DELETE(request: NextRequest) {
  try {
    assertSameOrigin(request);
  } catch {
    return authError('Invalid request origin.', 403);
  }
  const user = await currentUser(request);
  if (!user) return authError('Unauthorized.', 401);
  await revokeAllSessions(user.id);
  return NextResponse.json({ ok: true });
}
