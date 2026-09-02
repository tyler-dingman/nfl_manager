import { NextRequest, NextResponse } from 'next/server';
import { assertSameOrigin, authError } from '@/server/auth/http';
import { unlinkIdentity } from '@/server/auth/repository';
import { currentUser } from '@/server/auth/request';
export async function DELETE(request: NextRequest, { params }: { params: { identityId: string } }) {
  try {
    assertSameOrigin(request);
  } catch {
    return authError('Invalid request origin.', 403);
  }
  const user = await currentUser(request);
  if (!user) return authError('Unauthorized.', 401);
  try {
    await unlinkIdentity(user.id, params.identityId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return authError((error as Error).message);
  }
}
