import { gifReference, type GifReference } from '../gifs';
export function validateMessage(value: unknown): {
  body: string;
  media?: GifReference;
  replyTo?: string;
} {
  const v = value as Record<string, unknown>;
  if (!v || typeof v.body !== 'string' || v.body.length > 1000)
    throw Error('Message must be 1000 characters or fewer.');
  const body = v.body.trim(),
    media = v.media == null ? undefined : gifReference(v.media);
  if (!body && !media) throw Error('Add a message or GIF.');
  if (
    v.replyTo != null &&
    (typeof v.replyTo !== 'string' || !/^[a-zA-Z0-9_:-]{1,160}$/.test(v.replyTo))
  )
    throw Error('Invalid reply.');
  return {
    body,
    ...(media ? { media } : {}),
    ...(v.replyTo ? { replyTo: v.replyTo as string } : {}),
  };
}
