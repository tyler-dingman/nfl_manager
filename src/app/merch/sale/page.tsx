import type { Metadata } from 'next';
import MerchCategoryPage from '@/components/merch/merch-category-page';

export const metadata: Metadata = {
  title: 'Football Apparel Sale | Down & Distance',
  description: 'Real markdowns on original Down & Distance football-inspired gear.',
  alternates: { canonical: '/merch/sale' },
};
export default function SalePage() {
  return <MerchCategoryPage category="Sale" />;
}
