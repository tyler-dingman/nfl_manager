import { NextResponse } from 'next/server';
import { publicAuthConfig } from '@/server/auth/config';
export const dynamic = 'force-dynamic';
export function GET() {
  return NextResponse.json({ ok: true, ...publicAuthConfig() });
}
