import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authError, assertSameOrigin } from '@/server/auth/http';
import { currentUser } from '@/server/auth/request';
import { getOnboarding, updateOnboarding } from '@/server/user/repository';
export async function GET(r: NextRequest) {
  const u = await currentUser(r);
  return u
    ? NextResponse.json({ ok: true, onboarding: await getOnboarding(u.id) })
    : authError('Unauthorized.', 401);
}
export async function PATCH(r: NextRequest) {
  try {
    assertSameOrigin(r);
    const u = await currentUser(r);
    if (!u) return authError('Unauthorized.', 401);
    const i = z
      .object({ step: z.number().int().min(1).max(5), completed: z.boolean().optional() })
      .parse(await r.json());
    return NextResponse.json({
      ok: true,
      onboarding: await updateOnboarding(u.id, i.step, i.completed ?? false),
    });
  } catch {
    return authError('Unable to save onboarding progress.');
  }
}
