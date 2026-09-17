import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { consumeMobileHandoff } from '@/server/auth/mobile-handoff';
import { findUserById, toPublicUser } from '@/server/auth/repository';
import { issueSession } from '@/server/auth/service';
import { requestMetadata } from '@/server/auth/request';
import { checkRateLimit } from '@/server/auth/rate-limit';
import { authError } from '@/server/auth/http';

const schema = z.object({
  code: z.string().max(4096),
  codeVerifier: z.string().min(43).max(128),
  deviceId: z.string().uuid(),
});
export async function POST(request: NextRequest) {
  try {
    const metadata = requestMetadata(request);
    if (!checkRateLimit(`mobile-exchange:${metadata.ip ?? 'unknown'}`, 20, 15 * 60_000))
      return authError('Please try again later.', 429);
    const input = schema.parse(await request.json());
    const user = await findUserById(await consumeMobileHandoff(input.code, input.codeVerifier));
    if (!user || !['ACTIVE', 'PENDING'].includes(user.status))
      return authError('Sign-in unavailable.', 401);
    const session = await issueSession(user.id, { ...metadata, deviceId: input.deviceId });
    return NextResponse.json(
      { ok: true, user: toPublicUser(user), ...session },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch {
    return authError('Sign-in expired or was invalid. Please try again.', 401);
  }
}
