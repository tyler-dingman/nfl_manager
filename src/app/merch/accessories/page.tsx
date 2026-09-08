import type { Metadata } from 'next';
import MerchCategoryPage from '@/components/merch/merch-category-page';

export const metadata: Metadata = {
  title: 'Football Accessories | Down & Distance',
  description: 'City-inspired drinkware, bags, and accessories. No logos. Just football.',
  alternates: { canonical: '/merch/accessories' },
};
export default function AccessoriesPage() {
  return <MerchCategoryPage category="Accessories" />;
}
