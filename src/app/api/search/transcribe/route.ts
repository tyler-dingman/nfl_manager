import { NextResponse } from 'next/server';

import { checkRateLimit } from '@/server/auth/rate-limit';
import { WhisperHttpProvider } from '@/server/search/providers';

export const dynamic = 'force-dynamic';
const MAX_AUDIO_BYTES = 8 * 1024 * 1024;
const ALLOWED_AUDIO_TYPES = new Set([
  'audio/webm',
  'audio/ogg',
  'audio/mp4',
  'audio/mpeg',
  'audio/wav',
]);

export async function POST(request: Request) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  if (!checkRateLimit(`transcribe:${ip}`, 10, 60_000)) {
    return NextResponse.json({ error: 'Too many voice searches.' }, { status: 429 });
  }
  const form = await request.formData().catch(() => null);
  const audio = form?.get('audio');
  if (!(audio instanceof File) || audio.size === 0 || audio.size > MAX_AUDIO_BYTES) {
    return NextResponse.json({ error: 'Invalid audio recording.' }, { status: 400 });
  }
  const mime = audio.type.split(';')[0];
  if (!ALLOWED_AUDIO_TYPES.has(mime)) {
    return NextResponse.json({ error: 'Unsupported audio format.' }, { status: 415 });
  }
  try {
    const started = Date.now();
    // The recording is forwarded in memory and never persisted by Down & Distance.
    const text = await new WhisperHttpProvider().transcribe(audio, audio.name || 'search.webm');
    console.info(
      JSON.stringify({ metric: 'voice_transcription_complete', durationMs: Date.now() - started }),
    );
    return NextResponse.json({ text });
  } catch (error) {
    console.warn('[search] transcription unavailable', error);
    return NextResponse.json(
      { error: 'Voice search is temporarily unavailable.' },
      { status: 503 },
    );
  }
}
