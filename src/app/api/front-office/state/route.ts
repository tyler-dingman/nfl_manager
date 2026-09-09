import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { authError } from '@/server/auth/http';
import { currentUser } from '@/server/auth/request';
import {
  getFrontOfficeSaveMetadata,
  upsertFrontOfficeSaveMetadata,
} from '@/server/front-office/repository';

const bodySchema = z.object({
  saveId: z.string().min(1).max(160),
  teamAbbr: z
    .string()
    .min(2)
    .max(3)
    .transform((value) => value.toUpperCase()),
  season: z.number().int().min(1920).max(2200),
  selectedPath: z.enum(['full', 'free_agency', 'draft']).optional(),
  simulationPhase: z.string().min(1).max(80).optional(),
});

export async function GET(request: NextRequest) {
  const user = await currentUser(request);
  if (!user) return authError('Unauthorized.', 401);
  const saveId = request.nextUrl.searchParams.get('saveId');
  if (!saveId) return NextResponse.json({ error: 'saveId is required.' }, { status: 400 });
  return NextResponse.json({
    ok: true,
    state: await getFrontOfficeSaveMetadata(user.id, saveId),
  });
}

export async function PUT(request: NextRequest) {
  const user = await currentUser(request);
  if (!user) return authError('Unauthorized.', 401);
  const input = bodySchema.parse(await request.json());
  return NextResponse.json({
    ok: true,
    state: await upsertFrontOfficeSaveMetadata({ userId: user.id, ...input }),
  });
}
