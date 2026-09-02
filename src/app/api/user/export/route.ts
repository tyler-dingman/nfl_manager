import { NextRequest, NextResponse } from 'next/server';

import { assertSameOrigin, authError } from '@/server/auth/http';
import { currentUser } from '@/server/auth/request';
import { exportUserAccount } from '@/server/user/account-repository';

export async function GET(request: NextRequest) {
  const user = await currentUser(request);
  if (!user) return authError('Unauthorized.', 401);
  try {
    assertSameOrigin(request);
    return NextResponse.json({ ok: true, export: await exportUserAccount(user.id) });
  } catch {
    return NextResponse.json({ error: 'Unable to export account data.' }, { status: 500 });
  }
}