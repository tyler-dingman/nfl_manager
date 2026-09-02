import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { authError, assertSameOrigin } from '@/server/auth/http';
import { currentUser } from '@/server/auth/request';
import { listDevices, registerDevice, removeDevice } from '@/server/notifications/repository';

const deviceSchema = z.object({
  platform: z.enum(['IOS', 'ANDROID', 'WEB']),
  deviceName: z.string().trim().max(120).optional().nullable(),
  appVersion: z.string().trim().max(50).optional().nullable(),
  osVersion: z.string().trim().max(50).optional().nullable(),
  installationId: z.string().trim().min(8).max(200),
});

export async function GET(request: NextRequest) {
  const user = await currentUser(request);
  if (!user) return authError('Unauthorized.', 401);
  const devices = await listDevices(user.id);
  return NextResponse.json({ ok: true, devices });
}

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const user = await currentUser(request);
    if (!user) return authError('Unauthorized.', 401);

    const input = deviceSchema.parse(await request.json());
    const device = await registerDevice(user.id, input);
    return NextResponse.json({ ok: true, device });
  } catch {
    return authError('Unable to register device.');
  }
}

export async function DELETE(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const user = await currentUser(request);
    if (!user) return authError('Unauthorized.', 401);
    const { deviceId } = z.object({ deviceId: z.string().min(1) }).parse(await request.json());
    await removeDevice(user.id, deviceId);
    return NextResponse.json({ ok: true });
  } catch {
    return authError('Unable to remove device.');
  }
}
