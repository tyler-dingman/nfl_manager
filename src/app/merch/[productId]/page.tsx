import { notFound } from 'next/navigation';

import MerchProductDetail from '@/components/merch/merch-product-detail';
import type { MerchProduct } from '@/features/merch/catalog';
import { commerceProduct } from '@/server/commerce/catalog';

export const dynamic = 'force-dynamic';
export default async function MerchProductPage({ params }: { params: { productId: string } }) {
  const persisted = await commerceProduct(params.productId);
  const product = persisted
    ? ({
        id: persisted.id,
        name: persisted.name,
        category: persisted.category,
        type: persisted.variants[0]?.cityName ? 'Koozie' : persisted.category,
        price: persisted.basePriceCents / 100,
        colors: ['#00172B'],
        sizes: [
          ...new Set<string>(
            persisted.variants.map((variant: any) => variant.size).filter(Boolean),
          ),
        ],
        imageUrl: persisted.variants[0]?.imageUrl,
        cityCode: persisted.variants[0]?.cityCode,
        cityName: persisted.variants[0]?.cityName,
      } as MerchProduct)
    : null;
  if (!product) notFound();
  return <MerchProductDetail product={product} />;
}
