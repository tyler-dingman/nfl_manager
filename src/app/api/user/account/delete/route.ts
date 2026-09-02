import { NextRequest, NextResponse } from 'next/server';

import { assertSameOrigin, authError, clearSessionCookie } from '@/server/auth/http';
import { currentUser } from '@/server/auth/request';
import { deleteUserAccount } from '@/server/user/account-repository';

export async function POST(request: NextRequest) {
  const user = await currentUser(request);
  if (!user) return authError('Unauthorized.', 401);
  try {
    assertSameOrigin(request);
    const body = (await request.json()) as { confirmation?: string };
    if (body.confirmation !== 'DELETE') return NextResponse.json({ error: 'Type DELETE to confirm account deletion.' }, { status: 400 });
    await deleteUserAccount(user.id);
    const response = NextResponse.json({ ok: true });
    clearSessionCookie(response);
    return response;
  } catch {
    return NextResponse.json({ error: 'Unable to delete account.' }, { status: 500 });
  }
}