import { NextRequest, NextResponse } from 'next/server';
import { assertSameOrigin, authError } from '@/server/auth/http';
import { currentUser } from '@/server/auth/request';
import { claimReward } from '@/server/rewards/repository';

export async function POST(request: NextRequest, { params }: { params: { rewardId: string } }) {
  const user = await currentUser(request);
  if (!user) return authError('Unauthorized.', 401);
  try {
    assertSameOrigin(request);
    return NextResponse.json({ ok: true, reward: await claimReward(user.id, params.rewardId) });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to claim reward.' },
      { status: 409 },
    );
  }
}
