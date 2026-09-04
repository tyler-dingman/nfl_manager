import { createHash } from 'node:crypto';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type { ThreeOutNarration } from '@/features/three-and-out/catch-up-audio';

export const THREE_OUT_VOICE_VERSION = process.env.CHATTERBOX_VOICE_VERSION ?? 'chiefs-three-out-v2';
const cacheRoot = path.join(process.cwd(), 'private', 'tts', 'cache');

const cacheIdentity = (narration: ThreeOutNarration) =>
  createHash('sha256')
    .update(
      JSON.stringify({
        team: narration.teamId,
        voice: THREE_OUT_VOICE_VERSION,
        stories: narration.segments.map((segment) => segment.storyId),
        scripts: narration.segments.map((segment) => segment.script),
      }),
    )
    .digest('hex')
    .slice(0, 32);

const wavDurationMs = (buffer: Buffer) => {
  if (buffer.toString('ascii', 0, 4) !== 'RIFF') return 0;
  const byteRate = buffer.readUInt32LE(28);
  const dataOffset = buffer.indexOf('data', 12, 'ascii');
  if (!byteRate || dataOffset < 0) return 0;
  return Math.round((buffer.readUInt32LE(dataOffset + 4) / byteRate) * 1000);
};

export async function generateChatterboxSegments(narration: ThreeOutNarration) {
  const baseUrl = process.env.CHATTERBOX_BASE_URL?.replace(/\/$/, '');
  const token = process.env.CHATTERBOX_SERVICE_TOKEN;
  if (!baseUrl || !token) throw new Error('Chatterbox is not configured.');
  const key = cacheIdentity(narration);
  const directory = path.join(cacheRoot, key);
  await mkdir(directory, { recursive: true });
  const startedAt = Date.now();
  let hit = true;
  const segments = [];
  for (let index = 0; index < narration.segments.length; index += 1) {
    const filename = `segment-${index + 1}.wav`;
    const filepath = path.join(directory, filename);
    let audio: Buffer;
    try {
      await stat(filepath);
      audio = await readFile(filepath);
    } catch {
      hit = false;
      const response = await fetch(`${baseUrl}/generate`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-chatterbox-token': token },
        body: JSON.stringify({
          text: narration.segments[index].script,
          voice: THREE_OUT_VOICE_VERSION,
        }),
        signal: AbortSignal.timeout(900_000),
      });
      if (!response.ok) throw new Error(`Chatterbox generation failed (${response.status}).`);
      audio = Buffer.from(await response.arrayBuffer());
      await writeFile(filepath, audio, { flag: 'wx' }).catch(
        async (error: NodeJS.ErrnoException) => {
          if (error.code !== 'EEXIST') throw error;
        },
      );
    }
    segments.push({
      storyId: narration.segments[index].storyId,
      audioUrl: `/api/three-and-out/audio/${key}/${index + 1}`,
      durationMs: wavDurationMs(audio),
    });
  }
  console.info('[THREE & OUT TTS]', {
    provider: 'Chatterbox',
    voice: THREE_OUT_VOICE_VERSION,
    team: narration.teamId,
    stories: narration.segments.length,
    segments: segments.length,
    generationMs: Date.now() - startedAt,
    cache: hit ? 'HIT' : 'MISS',
  });
  return { provider: 'chatterbox' as const, voiceVersion: THREE_OUT_VOICE_VERSION, segments };
}

export async function readCachedChatterboxSegment(cacheKey: string, segment: number) {
  if (!/^[a-f0-9]{32}$/.test(cacheKey) || ![1, 2, 3].includes(segment)) return null;
  try {
    return await readFile(path.join(cacheRoot, cacheKey, `segment-${segment}.wav`));
  } catch {
    return null;
  }
}
