import { notFound } from 'next/navigation';

import MerchProductDetail from '@/components/merch/merch-product-detail';
import { MERCH_PRODUCTS } from '@/features/merch/catalog';

export function generateStaticParams() {
  return MERCH_PRODUCTS.map((product) => ({ productId: product.id }));
}

export default function MerchProductPage({ params }: { params: { productId: string } }) {
  const product = MERCH_PRODUCTS.find((candidate) => candidate.id === params.productId);
  if (!product) notFound();
  return <MerchProductDetail product={product} />;
}
