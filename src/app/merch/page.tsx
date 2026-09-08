import type { Metadata } from 'next';
import { Suspense } from 'react';
import MerchShop from '@/components/merch/merch-shop';

export const metadata: Metadata = {
  title: 'Football Apparel & Accessories | Down & Distance',
  description: 'Original city-inspired football apparel and accessories. No logos. Just football.',
  alternates: { canonical: '/merch' },
};

export default function MerchPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#f7f2e8]" aria-hidden="true" />}>
      <MerchShop />
    </Suspense>
  );
}
