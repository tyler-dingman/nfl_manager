import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authError, assertSameOrigin } from '@/server/auth/http';
import { currentUser } from '@/server/auth/request';
import { createCrew, getCrewForUser, leaveCrew, updateCrew } from '@/server/crew/repository';

const schema = z.object({
  name: z.string().trim().min(2).max(80),
  teamAbbr: z.string().trim().length(2).toUpperCase(),
});
export async function GET(request: NextRequest) {
  const user = await currentUser(request);
  if (!user) return authError('Unauthorized.', 401);
  return NextResponse.json({ crew: await getCrewForUser(user.id) });
}
export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const user = await currentUser(request);
    if (!user) return authError('Unauthorized.', 401);
    return NextResponse.json({
      ok: true,
      ...(await createCrew(user.id, schema.parse(await request.json()))),
    });
  } catch (error) {
    return authError(error instanceof Error ? error.message : 'Unable to create Crew.');
  }
}
export async function PATCH(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const user = await currentUser(request);
    if (!user) return authError('Unauthorized.', 401);
    await updateCrew(user.id, schema.partial().parse(await request.json()));
    return NextResponse.json({ ok: true });
  } catch (error) {
    return authError(error instanceof Error ? error.message : 'Unable to update Crew.');
  }
}
export async function DELETE(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const user = await currentUser(request);
    if (!user) return authError('Unauthorized.', 401);
    await leaveCrew(user.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return authError(error instanceof Error ? error.message : 'Unable to leave Crew.');
  }
}
