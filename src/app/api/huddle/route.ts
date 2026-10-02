import { NextResponse } from 'next/server';

// Disabled for the visual concept, including older clients still calling this API.
// Do not import authentication, repositories, or game providers here.
function disabled() {
  return NextResponse.json(
    { error: 'The Huddle is a visual concept only. Live data and server actions are disabled.' },
    { status: 503, headers: { 'Cache-Control': 'no-store' } },
  );
}
export const GET = disabled;
export const POST = disabled;
