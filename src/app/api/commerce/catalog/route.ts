import { NextResponse } from 'next/server';
import { commerceCatalog } from '@/server/commerce/catalog';
export const dynamic = 'force-dynamic';
export async function GET() {
  return NextResponse.json({ products: await commerceCatalog() });
}
