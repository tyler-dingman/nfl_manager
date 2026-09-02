import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { authError } from '@/server/auth/http';
import { currentUser } from '@/server/auth/request';
import { listSavedContent, saveContent, unsaveContent } from '@/server/user/content-repository';

const contentType = z.enum(['STORY', 'THREE_AND_OUT', 'AUDIO', 'VIDEO', 'PODCAST', 'OTHER']);
const saveSchema = z.object({
  contentType,
  contentId: z.string().min(1).max(300),
  title: z.string().min(1).max(500),
  href: z.string().max(1000).nullable().optional(),
  imageUrl: z.string().url().nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export async function GET(request: NextRequest) {
  const user = await currentUser(request);
  if (!user) return authError('Unauthorized.', 401);
  return NextResponse.json({ ok: true, items: await listSavedContent(user.id) });
}

export async function POST(request: NextRequest) {
  const user = await currentUser(request);
  if (!user) return authError('Unauthorized.', 401);
  try {
    return NextResponse.json({ ok: true, item: await saveContent(user.id, saveSchema.parse(await request.json())) }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Invalid saved content.' }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest) {
  const user = await currentUser(request);
  if (!user) return authError('Unauthorized.', 401);
  const type = contentType.safeParse(request.nextUrl.searchParams.get('contentType'));
  const id = request.nextUrl.searchParams.get('contentId');
  if (!type.success || !id) return NextResponse.json({ error: 'contentType and contentId are required.' }, { status: 400 });
  await unsaveContent(user.id, type.data, id);
  return NextResponse.json({ ok: true });
}