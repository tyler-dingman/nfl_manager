import { z } from 'zod';

export const crewPostSchema = z
  .object({
    kind: z.enum(['TEXT', 'PHOTO', 'LINK']),
    message: z.string().trim().max(4000).default(''),
    mediaId: z.string().uuid().optional(),
    href: z
      .string()
      .url()
      .max(2048)
      .refine((value) => /^https?:\/\//i.test(value), 'Use an http or https link.')
      .optional(),
  })
  .superRefine((post, ctx) => {
    if (post.kind === 'TEXT' && !post.message)
      ctx.addIssue({ code: 'custom', message: 'Write a message first.', path: ['message'] });
    if (post.kind === 'PHOTO' && !post.mediaId)
      ctx.addIssue({ code: 'custom', message: 'Choose a photo first.', path: ['mediaId'] });
    if (post.kind === 'LINK' && !post.href)
      ctx.addIssue({ code: 'custom', message: 'Enter a valid link.', path: ['href'] });
  });
export const crewCommentSchema = z.object({ message: z.string().trim().min(1).max(2000) });
export const crewUpdateSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  teamAbbr: z.string().trim().min(2).max(3).toUpperCase().optional(),
  photoMediaId: z.string().uuid().optional(),
});

export function validateCrewImage(bytes: Uint8Array, mime: string) {
  if (!bytes.length || bytes.length > 2 * 1024 * 1024) throw new Error('Photo must be under 2 MB.');
  const png =
    bytes.length >= 8 && [137, 80, 78, 71, 13, 10, 26, 10].every((v, i) => bytes[i] === v);
  const jpeg = bytes.length >= 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  const webp =
    bytes.length >= 12 &&
    String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' &&
    String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP';
  if (
    !(
      (mime === 'image/png' && png) ||
      (mime === 'image/jpeg' && jpeg) ||
      (mime === 'image/webp' && webp)
    )
  )
    throw new Error('Choose a JPEG, PNG, or WebP photo.');
}
