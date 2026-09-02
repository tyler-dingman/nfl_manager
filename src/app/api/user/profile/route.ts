import { NextRequest, NextResponse } from 'next/server';
import { authError, assertSameOrigin } from '@/server/auth/http';
import { currentUser } from '@/server/auth/request';
import { getProfile, updateProfile } from '@/server/user/repository';
import { profileSchema } from '@/server/user/validation';
export async function GET(r: NextRequest) {
  const u = await currentUser(r);
  return u
    ? NextResponse.json({ ok: true, profile: await getProfile(u.id) })
    : authError('Unauthorized.', 401);
}
export async function PATCH(r: NextRequest) {
  try {
    assertSameOrigin(r);
    const u = await currentUser(r);
    if (!u) return authError('Unauthorized.', 401);
    return NextResponse.json({
      ok: true,
      profile: await updateProfile(u.id, profileSchema.parse(await r.json())),
    });
  } catch {
    return authError('Check your profile details.');
  }
}
