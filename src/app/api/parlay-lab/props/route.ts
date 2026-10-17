import { NextRequest, NextResponse } from 'next/server';
import { getPropCatalogResponse } from '@/server/odds/prop-catalog';
export const dynamic = 'force-dynamic';
export async function GET(request: NextRequest) {
  try {
    return new NextResponse(await getPropCatalogResponse(request.nextUrl.searchParams), {
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    });
  } catch {
    return NextResponse.json(
      { error: 'Available props could not be loaded. Please try again.' },
      { status: 503 },
    );
  }
}
