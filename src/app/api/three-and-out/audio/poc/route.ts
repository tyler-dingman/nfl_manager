import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { NextRequest, NextResponse } from 'next/server';

import { authError } from '@/server/auth/http';
import { currentUser } from '@/server/auth/request';

const recordingPath = path.join(
  process.cwd(),
  'apps/web/private/tts/final_chiefs_three_and_out.wav',
);

export async function GET(request: NextRequest) {
  const user = await currentUser(request);
  if (!user) return authError('Unauthorized.', 401);

  try {
    const audio = await readFile(recordingPath);
    return new NextResponse(audio, {
      headers: {
        'Cache-Control': 'private, max-age=3600',
        'Content-Type': 'audio/wav',
      },
    });
  } catch (error) {
    console.error('[THREE & OUT POC] Unable to read the recorded Chiefs audio.', error);
    return NextResponse.json({ error: 'Audio unavailable.' }, { status: 503 });
  }
}
