import { NextRequest, NextResponse } from 'next/server';
import { authError, assertSameOrigin } from '@/server/auth/http';
import { currentUser } from '@/server/auth/request';
import { getPreferences, updatePreferences } from '@/server/user/repository';
import { preferencesSchema } from '@/server/user/validation';
export async function GET(r: NextRequest) {
  const u = await currentUser(r);
  return u
    ? NextResponse.json({ ok: true, preferences: await getPreferences(u.id) })
    : authError('Unauthorized.', 401);
}
export async function PATCH(r: NextRequest) {
  try {
    assertSameOrigin(r);
    const u = await currentUser(r);
    if (!u) return authError('Unauthorized.', 401);
    return NextResponse.json({
      ok: true,
      preferences: await updatePreferences(u.id, preferencesSchema.parse(await r.json())),
    });
  } catch {
    return authError('Check your preference values.');
  }
}
