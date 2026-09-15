import { NextResponse } from 'next/server';
import { listLocalOddsEvents } from '@/server/odds/repository';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({ events: await listLocalOddsEvents() });
}
