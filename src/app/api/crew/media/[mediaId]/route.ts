import { NextRequest, NextResponse } from 'next/server';
import { currentUser } from '@/server/auth/request';
import { authError } from '@/server/auth/http';
import { authDb } from '@/server/auth/database';
import { z } from 'zod';
export async function GET(request: NextRequest, { params }: { params: { mediaId: string } }) {
  const user = await currentUser(request);
  if (!user) return authError('Unauthorized.', 401);
  if (!z.string().uuid().safeParse(params.mediaId).success)
    return authError('Photo not found.', 404);
  const rows = await authDb()<
    Array<{ content: Buffer; mime_type: string }>
  >`SELECT media.content,media.mime_type FROM crew_media media JOIN crew_members m ON m.crew_id=media.crew_id WHERE media.id=${params.mediaId} AND m.user_id=${user.id} AND m.status='ACTIVE' LIMIT 1`;
  if (!rows[0]) return authError('Photo not found.', 404);
  return new NextResponse(new Uint8Array(rows[0].content), {
    headers: {
      'Content-Type': rows[0].mime_type,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
