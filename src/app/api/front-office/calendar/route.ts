import { NextResponse } from 'next/server';
import { getNFLCalendarState } from '@/server/front-office/calendar';

export async function GET() {
  return NextResponse.json({ ok: true, calendar: await getNFLCalendarState() });
}
