import { NextRequest, NextResponse } from 'next/server';
import { authError, assertSameOrigin } from '@/server/auth/http';
import { currentUser } from '@/server/auth/request';
import { acceptCrewInvite, inspectCrewInvite } from '@/server/crew/repository';
export async function GET(_: NextRequest, { params }: { params: { token: string } }) {
  const invite = await inspectCrewInvite(params.token);
  return invite ? NextResponse.json({ invite }) : authError('Invite not found.', 404);
}
export async function POST(request: NextRequest, { params }: { params: { token: string } }) {
  try {
    assertSameOrigin(request);
    const user = await currentUser(request);
    if (!user) return authError('Unauthorized.', 401);
    return NextResponse.json({ ok: true, ...(await acceptCrewInvite(user.id, params.token)) });
  } catch (error) {
    return authError(error instanceof Error ? error.message : 'Unable to join Crew.');
  }
}
