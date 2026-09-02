import { NextRequest, NextResponse } from 'next/server';
import { authError } from '@/server/auth/http';
import { listIdentities } from '@/server/auth/repository';
import { currentUser } from '@/server/auth/request';
export async function GET(request: NextRequest) {
  const user = await currentUser(request);
  return user
    ? NextResponse.json({ ok: true, identities: await listIdentities(user.id) })
    : authError('Unauthorized.', 401);
}
