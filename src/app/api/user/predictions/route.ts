import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { assertSameOrigin, authError } from '@/server/auth/http';
import { currentUser } from '@/server/auth/request';
import { createPrediction, listPredictions } from '@/server/user/content-repository';

const schema = z.object({
  predictionType: z.string().min(1).max(80),
  subjectType: z.string().min(1).max(80),
  subjectId: z.string().min(1).max(300),
  prediction: z.unknown(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  lockedAt: z.string().datetime().nullable().optional(),
});

export async function GET(request: NextRequest) {
  const user = await currentUser(request);
  if (!user) return authError('Unauthorized.', 401);
  return NextResponse.json({ ok: true, predictions: await listPredictions(user.id) });
}

export async function POST(request: NextRequest) {
  const user = await currentUser(request);
  if (!user) return authError('Unauthorized.', 401);
  try {
    assertSameOrigin(request);
    const input = schema.parse(await request.json());
    if (input.lockedAt && new Date(input.lockedAt).getTime() <= Date.now()) {
      return NextResponse.json({ error: 'This prediction is locked.' }, { status: 409 });
    }
    return NextResponse.json({ ok: true, prediction: await createPrediction(user.id, input) }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Invalid prediction.' }, { status: 400 });
  }
}