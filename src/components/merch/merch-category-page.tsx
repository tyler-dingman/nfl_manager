import { Suspense } from 'react';
import MerchShop from '@/components/merch/merch-shop';
import type { MerchCategory } from '@/features/merch/catalog';

export default function MerchCategoryPage({ category }: { category: MerchCategory }) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#f7f2e8]" aria-hidden="true" />}>
      <MerchShop categoryPage={category} />
    </Suspense>
  );
}
