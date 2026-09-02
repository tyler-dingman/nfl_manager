import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';

import { authDb } from '@/server/auth/database';
import { currentUser } from '@/server/auth/request';

const COOKIE = 'dd_trivia_guest';
const secret = () => process.env.AUTH_JWT_SECRET ?? 'down-distance-local-trivia';
const sign = (id: string) => createHmac('sha256', secret()).update(id).digest('base64url');

function readGuest(request: NextRequest) {
  const [id, signature] = (request.cookies.get(COOKIE)?.value ?? '').split('.');
  if (!id || !signature) return null;
  const expected = sign(id);
  if (signature.length !== expected.length) return null;
  return timingSafeEqual(Buffer.from(signature), Buffer.from(expected)) ? id : null;
}

export async function triviaPlayer(request: NextRequest, createGuest = false) {
  const user = await currentUser(request);
  if (user) return { id: user.id, guest: false, token: null };
  const existing = readGuest(request);
  if (existing) return { id: existing, guest: true, token: null };
  if (!createGuest) return null;
  const id = randomUUID();
  await authDb()`INSERT INTO users(id,display_name,status,is_guest) VALUES(${id},'Guest Player','ACTIVE',true)`;
  return { id, guest: true, token: `${id}.${sign(id)}` };
}

export function setTriviaGuestCookie(response: NextResponse, token: string) {
  response.cookies.set(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24,
  });
}
