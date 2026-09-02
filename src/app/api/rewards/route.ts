import { NextRequest, NextResponse } from 'next/server';
import { authError } from '@/server/auth/http';
import { currentUser } from '@/server/auth/request';
import { getRewardsDashboard } from '@/server/rewards/repository';

export async function GET(request: NextRequest) {
  const user = await currentUser(request);
  if (!user) return authError('Unauthorized.', 401);
  return NextResponse.json({ ok: true, rewards: await getRewardsDashboard(user.id) });
}
