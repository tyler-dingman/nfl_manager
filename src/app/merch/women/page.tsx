import type { Metadata } from 'next';
import MerchCategoryPage from '@/components/merch/merch-category-page';

export const metadata: Metadata = {
  title: "Women's Football Apparel | Down & Distance",
  description: 'Original football-inspired apparel made for Sundays and every day after.',
  alternates: { canonical: '/merch/women' },
};
export default function WomenPage() {
  return <MerchCategoryPage category="Women" />;
}
