import { NextRequest, NextResponse } from 'next/server';
import {
  applicationBackend,
  applicationStorage,
  applicationEnvironment,
} from '@/server/persistence/bindings';
import { MailQueue } from '../../../../../packages/storage/mail';
export const dynamic = 'force-dynamic';
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token') ?? '';
  if (!/^[a-f0-9]+\.[a-f0-9]{64}$/.test(token) || token.length > 2200)
    return new Response('Invalid link', { status: 400 });
  return new Response(
    `<html><head><meta name="referrer" content="no-referrer"><title>Email preferences</title></head><body><h1>Three &amp; Out email</h1><form method="post" action="?token=${token}"><button>Unsubscribe</button></form></body></html>`,
    {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
        'Referrer-Policy': 'no-referrer',
        'Content-Security-Policy': "default-src 'none'; form-action 'self'; frame-ancestors 'none'",
      },
    },
  );
}
export async function POST(request: NextRequest) {
  try {
    const secret = applicationEnvironment().APP_MAIL_ENCRYPTION_KEY;
    if (applicationBackend() !== 'd1' || !secret)
      return NextResponse.json({ error: 'Email preferences unavailable.' }, { status: 503 });
    await new MailQueue(applicationStorage(), secret).unsubscribe(
      request.nextUrl.searchParams.get('token') ?? '',
    );
    return NextResponse.json(
      { ok: true, message: 'You are unsubscribed from Three & Out email.' },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch {
    return NextResponse.json({ error: 'Invalid or expired unsubscribe link.' }, { status: 400 });
  }
}
