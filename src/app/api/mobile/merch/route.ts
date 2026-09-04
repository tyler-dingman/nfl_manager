import { NextResponse } from 'next/server';
import { MERCH_CATEGORIES } from '@/features/merch/catalog';
import { commerceCatalog } from '@/server/commerce/catalog';
export const dynamic = 'force-dynamic';
export async function GET() {
  const products = (await commerceCatalog()).map((product: any) => ({
    id: product.id,
    name: product.name,
    category: product.category,
    type: product.variants[0]?.cityName ? 'Koozie' : product.category,
    price: product.basePriceCents / 100,
    colors: ['#00172B'],
    sizes: [...new Set(product.variants.map((variant: any) => variant.size).filter(Boolean))],
    imageUrl: product.variants[0]?.imageUrl,
    badge: product.featured ? 'New' : undefined,
    cityCode: product.variants[0]?.cityCode,
    cityName: product.variants[0]?.cityName,
  }));
  return NextResponse.json({ categories: ['New & Trending', ...MERCH_CATEGORIES], products });
}
