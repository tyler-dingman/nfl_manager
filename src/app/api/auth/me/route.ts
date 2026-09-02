import { NextRequest, NextResponse } from 'next/server';
import { currentUser } from '@/server/auth/request';
export const dynamic = 'force-dynamic';
export async function GET(request: NextRequest) {
  const user = await currentUser(request);
  return user
    ? NextResponse.json({ ok: true, user })
    : NextResponse.json({ ok: false, user: null }, { status: 401 });
}
