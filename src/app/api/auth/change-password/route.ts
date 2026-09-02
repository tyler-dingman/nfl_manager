import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { assertSameOrigin, authError, clearSessionCookie } from '@/server/auth/http';
import { currentUser } from '@/server/auth/request';
import { updatePassword } from '@/server/auth/service';
export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const user = await currentUser(request);
    if (!user) return authError('Unauthorized.', 401);
    const input = z
      .object({
        currentPassword: z.string().min(1).max(256),
        newPassword: z.string().min(10).max(256),
      })
      .parse(await request.json());
    await updatePassword(user.id, input.currentPassword, input.newPassword);
    const response = NextResponse.json({ ok: true });
    clearSessionCookie(response);
    return response;
  } catch (error) {
    return authError(
      error instanceof z.ZodError ? 'Check your password details.' : (error as Error).message,
    );
  }
}
