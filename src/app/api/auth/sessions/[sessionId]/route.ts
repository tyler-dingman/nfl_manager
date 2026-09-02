import { NextRequest, NextResponse } from 'next/server';
import { assertSameOrigin, authError } from '@/server/auth/http';
import { revokeSessionById } from '@/server/auth/repository';
import { currentUser } from '@/server/auth/request';
export async function DELETE(request: NextRequest, { params }: { params: { sessionId: string } }) {
  try {
    assertSameOrigin(request);
  } catch {
    return authError('Invalid request origin.', 403);
  }
  const user = await currentUser(request);
  if (!user) return authError('Unauthorized.', 401);
  await revokeSessionById(user.id, params.sessionId);
  return NextResponse.json({ ok: true });
}
