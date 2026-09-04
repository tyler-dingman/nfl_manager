import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authError, assertSameOrigin } from '@/server/auth/http';
import { currentUser } from '@/server/auth/request';
import { createCrewInvite } from '@/server/crew/repository';

const schema = z
  .object({
    channel: z.enum(['IN_APP', 'SMS', 'EMAIL', 'SHARE_LINK']),
    recipient: z.string().trim().max(254).optional(),
    inviteeUserId: z.string().uuid().optional(),
  })
  .superRefine((v, c) => {
    if (v.channel === 'EMAIL' && v.recipient && !z.string().email().safeParse(v.recipient).success)
      c.addIssue({ code: 'custom', message: 'Enter a valid email.' });
    if (v.channel === 'SMS' && v.recipient && v.recipient.replace(/\D/g, '').length < 10)
      c.addIssue({ code: 'custom', message: 'Enter a valid phone number.' });
    if (!v.inviteeUserId && !v.recipient && v.channel !== 'SHARE_LINK')
      c.addIssue({ code: 'custom', message: 'A recipient is required.' });
  });
export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const user = await currentUser(request);
    if (!user) return authError('Unauthorized.', 401);
    return NextResponse.json({
      ok: true,
      invite: await createCrewInvite(user.id, schema.parse(await request.json())),
    });
  } catch (error) {
    return authError(error instanceof Error ? error.message : 'Unable to create invite.');
  }
}
