import { NextRequest, NextResponse } from 'next/server';

import { currentUser } from '@/server/auth/request';
import { readCachedChatterboxSegment } from '@/server/three-and-out/chatterbox';

export async function GET(
  request: NextRequest,
  { params }: { params: { cacheKey: string; segment: string } },
) {
  if (!(await currentUser(request))) return new NextResponse(null, { status: 401 });
  const audio = await readCachedChatterboxSegment(params.cacheKey, Number(params.segment));
  if (!audio) return new NextResponse(null, { status: 404 });
  return new NextResponse(audio, {
    headers: {
      'content-type': 'audio/wav',
      'cache-control': 'private, max-age=86400',
      'content-length': String(audio.byteLength),
    },
  });
}
